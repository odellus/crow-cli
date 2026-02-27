"""
Pytest configuration for E2E tests
"""

import pytest
from playwright.sync_api import Page, Browser


@pytest.fixture(scope="session")
def browser():
    """Create a browser instance for the test session"""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture(scope="function")
def page(browser: Browser):
    """Create a new page for each test"""
    context = browser.new_context()
    page = context.new_page()
    yield page
    page.close()
    context.close()
