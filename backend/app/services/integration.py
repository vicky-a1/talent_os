from __future__ import annotations

import logging


logger = logging.getLogger(__name__)


def send_mock_email(recipient: str, template: str) -> None:
    """
    Mock integration for email sending.

    This is the only intended side effect used by the orchestrator at this stage.
    """

    if not isinstance(recipient, str) or not recipient.strip():
        raise ValueError("recipient must be a non-empty string")
    if not isinstance(template, str) or not template.strip():
        raise ValueError("template must be a non-empty string")

    logger.info(
        "Mock email sent",
        extra={"recipient": recipient.strip(), "template": template.strip()},
    )
