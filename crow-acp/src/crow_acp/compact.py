"""
file:           compact.py
description:    a place for functions which
                1. configure the compact function/callback
                2. callback analyzes if the request tokens + the response tokens put us over a compaction threshold
                3. tokenize and threshold/truncate the output of tool execution/possibly user input. this is a pre-request hook
                4. So We're Over The Limit officially now what?

Steps to Compaction:
- identify if request tokens + response tokens put us over the threshold
- when they do we essentially session/cancel and exit react loop and send a new canned prompt to the agent which says "call no tools create a summary of this conversation from after the user's first query up until RIGHT BEFORE the current react turn
- we can figure out a way to use permissions to basically turn off any model calls and emit a "you can't use tools right now respond directly to user {repeats_prompt}" in there if the model disobeys. this is the only time we really care about permissions
- we take the user's first message and append the summary we get back from session/prompt on the fully loaded kv cache in the session that just crossed threshold [we set it well lower than actual model capabilities in practice] as a {role: assistant, content: output_message } turn, and if we have another user response before our last react turn [highly likely!!] then we append that, then we prefill session.messages with the exact content from the conversation we are compacting
- we go ahead and initiate session/prompt with the prefilled message [this might be tricky..., we might end up figuring out a pause/resume mechanism for session/cancel just to implement this and prefill can be tricky with locally hosted reasoning models] if nothing else this can be something where we absolutely just prefill the session and save it and then do load_session and a canned "you were compacted but you should still see everything continue exactly what you were doing please" message if doing session/prompt with prefill and only prefill ends up being a can of worms

- but yeah this is mostly just about the idea that compaction can be greatly accelerated by using the current kv cache session to compact itself. it already has all the context. get it to generate the compacted middle parts so we can keep

- user's original request, even if it's a simple "hey"
- last react turn <- literally what we were doing when compacted. I mean things happen. tool calls time out. the agent sometimes gets stopped mid stream. we can just treat like any other cancel event and maybe even a extremely simple "please proceed with what you were doing" will work best? we'll see
"""

from acp.schema import NewSessionResponse
from openai import AsyncOpenAI
from openai._utils import _typing

from crow_acp.prompt import render_template
from crow_acp.session import Session

MAX_COMPACT_TOKENS = 8192


COMPACTION_PROMPT = """Please summarize everything in the conversation that happened AFTER the user's first message and before the current react turn began.
FIRST USER MESSAGE:
{{ first_message }}

[what we want you to summarize in one very long block of beautiful markdown that illustrates the conversation in the context of the task you and the user are trying to accomplish in such a way that it splines/interpolates/segues naturally upon compacting]

LAST USER MESSAGE:
{{ last_message }}
"""


def get_last_user_idx(messages: list[dict[str, str]]) -> int:
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user":
            return i
    return -1


async def non_streaming_request(
    model: str,
    messages: list[dict],
    tools: list[dict],
    request_params: dict,
    llm: AsyncOpenAI,
) -> str:
    response = await llm.chat.completions.create(
        model=model,
        messages=messages,
        tools=tools,
        tool_choice="none",
        **request_params,
    )
    return response.choices[0].message.content


def construct_compact_prompt(messages: list[dict]) -> tuple[list[dict], int]:
    first_message = messages[1]
    last_usr_msg_idx = get_last_user_idx(messages)
    last_message = messages[last_usr_msg_idx]
    prompt = render_template(
        COMPACTION_PROMPT,
        first_message=first_message,
        last_message=last_message,
    )
    return (
        messages + [dict(role="user", content=prompt)],
        last_usr_msg_idx,
    )


async def get_middle_message(
    session: Session,
    llm: AsyncOpenAI,
) -> tuple[str, int]:
    messages = session.messages
    model: str = session.model_identifier
    messages: list[dict] = session.messages
    tools: list[dict] = session.tools
    request_params: dict = session.request_params
    # Always step on the request param's max_completion_tokens
    request_params["max_completion_tokens"] = MAX_COMPACT_TOKENS
    compact_prompt, last_usr_msg_idx = construct_compact_prompt(messages)
    middle_message = await non_streaming_request(
        model=model,
        messages=compact_prompt,
        tools=tools,
        request_params=request_params,
        llm=llm,
    )
    return middle_message, last_usr_msg_idx


async def compact(
    session: Session,
    llm: AsyncOpenAI,
    cwd: str,
) -> Session:
    """We are going to compact the conversation by doing the following steps:
    1. Get the middle message
    2. Replace the middle of messages with the compacted message
    3. Create a new session with the new messages
    4. Return the new session
    """
    # Summarize the conversation's middle
    middle_message, last_usr_msg_idx = await get_middle_message(session, llm)
    orig_messages = session.messages
    messages = (
        [orig_messages[1]]  # First user message (skipping system at 0)
        + [dict(role="assistant", content=middle_message)]
        + orig_messages[last_usr_msg_idx:]  # last user message is included
    )

    new_session = Session.create(
        prompt_id=session.prompt_id,
        prompt_args=session.prompt_args,
        tool_definitions=session.tools,
        request_params=session.request_params,
        model_identifier=session.model_identifier,
        db_path=session.db_path,
        cwd=cwd,
        initial_messages=messages,
    )

    return new_session
