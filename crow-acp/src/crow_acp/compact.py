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
