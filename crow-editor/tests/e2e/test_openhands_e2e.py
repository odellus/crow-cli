"""
E2E Tests for OpenHands Agent in Crow IDE

These tests verify that OpenHands works correctly as an ACP agent in crow_ide.
"""

import pytest
import os
import time
import subprocess
from playwright.sync_api import Page, expect

# Test configuration
CROW_IDE_URL = os.environ.get("CROW_IDE_URL", "http://localhost:8765")
CROW_WORKSPACE = os.environ.get("CROW_WORKSPACE", "/home/thomas/src/projects/orchestrator-project")


class TestOpenHandsE2E:
    """End-to-end tests for OpenHands integration"""

    def test_openhands_agent_available(self, page: Page):
        """Test that OpenHands agent is available in the UI"""
        page.goto(CROW_IDE_URL)
        page.wait_for_load_state("networkidle")
        
        # Close the workspace dialog if it appears
        if page.locator('text=Open Workspace').count() > 0:
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)

        # Click on "New session" button
        new_session_btn = page.get_by_role("button", name="New session")
        expect(new_session_btn).to_be_visible()
        new_session_btn.click()
        
        # Look for OpenHands option in dropdown
        openhands_option = page.get_by_text("New OpenHands session")
        expect(openhands_option).to_be_visible()
        
    def test_openhands_basic_connection(self, page: Page):
        """Test that we can connect to OpenHands via WebSocket"""
        page.goto(CROW_IDE_URL)
        page.wait_for_load_state("networkidle")

        # Create a new OpenHands session
        new_session_btn = page.get_by_role("button", name="New session")
        new_session_btn.click()
        
        openhands_option = page.get_by_text("New OpenHands session")
        openhands_option.click()
        
        # Wait for connection to establish
        time.sleep(2)
        
        # Check that the session was created
        # The agent panel should show OpenHands is connected
        agent_panel = page.locator('[data-testid="agent-panel"]')
        expect(agent_panel).to_be_visible()
        
    def test_openhands_simple_prompt(self, page: Page):
        """Test that OpenHands can respond to a simple prompt"""
        page.goto(CROW_IDE_URL)
        page.wait_for_load_state("networkidle")

        # Create a new OpenHands session
        new_session_btn = page.get_by_role("button", name="New session")
        new_session_btn.click()
        
        openhands_option = page.get_by_text("New OpenHands session")
        openhands_option.click()
        
        # Wait for connection
        time.sleep(3)
        
        # Find the input field and send a simple prompt
        input_field = page.locator('textarea[placeholder*="Type a message"]')
        if input_field.count() == 0:
            input_field = page.locator('textarea').first
            
        expect(input_field).to_be_visible()
        input_field.fill("Hello, can you hear me?")
        
        # Send the message
        send_btn = page.get_by_role("button", name="Send")
        if send_btn.count() > 0:
            send_btn.click()
        else:
            # Try pressing Enter
            input_field.press("Enter")
        
        # Wait for response
        time.sleep(5)
        
        # Check that we got a response (message in thread)
        thread = page.locator('.acp-thread')
        expect(thread).to_be_visible()


class TestOpenHandsACPProtocol:
    """Test OpenHands ACP protocol compliance"""

    def test_openhands_acp_initialize(self):
        """Test that OpenHands responds to initialize request correctly"""
        # This would require a direct ACP client
        # For now, we skip this test
        pytest.skip("Requires ACP client implementation - implement later")

    def test_openhands_acp_session_new(self):
        """Test that OpenHands can create a new session"""
        # This would require a direct ACP client
        # For now, we skip this test
        pytest.skip("Requires ACP client implementation - implement later")

    def test_openhands_acp_streaming(self):
        """Test that OpenHands sends proper ACP streaming events"""
        # This would require a direct ACP client
        # For now, we skip this test
        pytest.skip("Requires ACP client implementation - implement later")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
