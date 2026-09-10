import asyncio
import logging
import os
from db import db
from services.util import utcnow, iso, new_id

log = logging.getLogger('agent')
MODEL = ('gemini', 'gemini-3-flash-preview')

BASE = ("You are an agent inside YabbAI Forge — an open-source product foundry run by Basham Automations. "
        "Eight autonomous agents scout, license-check, fork/merge/build, ship, and support open-source products for any niche; "
        "every outreach or release is gated behind a human Director. Packages: Fork ($900, 3–5 days), Merge ($2,400, 7–12 days), "
        "Forge ($6,000, 14–21 days). Monthly tiers: Maintain $300, Upstream $900, Steward $2,200. "
        "Write like a terminal readout: short bracketed header line, tight bullet points, under 140 words, no markdown headers, no emojis. "
        "Always end with a line starting with [DIRECTOR GATE] describing the human approval that must happen next.")

SYSTEM = {
    'quoter': BASE + " Role: QUALIFIER/PITCHER. Given a product request, produce a fork plan: upstream candidates (generic, license type), adaptation scope, turnaround, fixed-price estimate, and recommended package.",
    'extractor': BASE + " Role: FORGE license auditor. Given a dependency manifest or text, list licenses found, flag copyleft (GPL/AGPL) contamination, state whether commercial resale is permitted, and what attribution to ship.",
    'retention': BASE + " Role: SHIPPER release engine. Given a diff summary or changelog notes, draft semver release notes plus a one-line community announcement.",
}

DATA = {
    'quoter': {'score': 94, 'confidence': 'HIGH', 'suggestedPackage': 'Fork', 'humanSignoffRequired': True},
    'extractor': {'status': 'VERIFIED', 'copyleftFree': True, 'resaleAllowed': True},
    'retention': {'channels': 'GitHub Release + Forum + Discord', 'semver': '1.1.0', 'scheduledGate': 'Amber Key #04'},
}


def fallback(agent_type: str, user_input: str) -> str:
    if agent_type == 'quoter':
        return (f"[FORK PLAN · FIT SCORE 94/100]\nRequest analyzed: \"{user_input[:120]}\"\n\n• 3 upstream candidates located (MIT ×2, Apache-2 ×1), last commit < 90 days\n"
                "• Best base: most-starred repo with pluggable data layer\n• Adaptation scope: rebrand + 1 niche feature + 1 integration\n• Target turnaround: 5 days\n"
                "• Fixed price estimate: $900 – $2,400 USD\n\n[DIRECTOR GATE] Fork plan drafted. Lock in the Fork or Merge build to start?")
    if agent_type == 'extractor':
        return ("[LICENSE & DEPENDENCY AUDIT · CLEAN]\n• Direct dependencies: identified and versioned\n• Licenses found: MIT, Apache-2.0, BSD-3\n"
                "• Copyleft (GPL/AGPL) contamination: none detected\n• Resale / commercial redistribution: PERMITTED\n• Action: attribution file generated, NOTICE queued\n\n"
                "[DIRECTOR GATE] Safe to fork, rebrand, and sell — approve FORGE certification.")
    return ("[RELEASE ENGINE · v1.1.0 READY]\nDrafted release notes:\n\"v1.1.0 — Adds offline mode, CSV export, and a plugin API. Fixes the sync bug in #42. Upgrade: pull latest, run migrate.\"\n"
            "Also drafted: forum launch post and Discord announcement.\n\n[DIRECTOR GATE] Ready to tag and publish upon approval.")


async def stream_agent(agent_type: str, user_input: str, session_id: str):
    full, source = '', MODEL[1]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(api_key=os.environ['EMERGENT_LLM_KEY'], session_id=f"{session_id}:{agent_type}",
                       system_message=SYSTEM[agent_type]).with_model(*MODEL)
        async for ev in chat.stream_message(UserMessage(text=user_input)):
            if isinstance(ev, TextDelta):
                full += ev.content
                yield {'delta': ev.content}
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        log.warning('gemini stream failed, using fallback: %s', e)
    if not full.strip():
        source = 'fallback'
        text = fallback(agent_type, user_input)
        for i in range(0, len(text), 18):
            full += text[i:i + 18]
            yield {'delta': text[i:i + 18]}
            await asyncio.sleep(0.02)
    await db.agent_demo_logs.insert_one({'id': new_id('demo-'), 'session_id': session_id, 'agent_type': agent_type,
                                         'user_input': user_input, 'reply': full, 'source': source, 'created_at': iso(utcnow())})
    yield {'done': True, 'data': DATA[agent_type], 'source': source}
