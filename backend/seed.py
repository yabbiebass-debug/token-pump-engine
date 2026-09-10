import logging
from datetime import timedelta
from db import db
from constants import SOL_RECIPIENT
from services import flywheel
from services.events import get_app_state
from services.util import utcnow, iso

log = logging.getLogger('seed')


def _ago(hours: float) -> str:
    return iso(utcnow() - timedelta(hours=hours))


LEADS = [
    {'id': 'lead-01', 'biz': 'Trailhead Collective', 'niche': 'Recreation & Outdoors', 'region': 'Colorado, US', 'email': 'hello@trailheadcollective.org', 'phone': '+1 720 555 0142',
     'pain': 'Hiking club of 2,300 members runs trip sign-ups on a spreadsheet; every closed-source app charges per member.',
     'fit': 'Tier 1 · Large community · Clear upstream (open trip-planner repo, MIT)', 'score': 94, 'stage': 'BUILD', 'source': 'Website Opportunity Scan',
     'notes': 'Bought Merge. BUILDER merging trip-planner + gear-share + Stripe dues into one app.', 'created_at': _ago(28), 'estimatedValue': 2400},
    {'id': 'lead-02', 'biz': 'Pixel Foundry Servers', 'niche': 'Gaming & Modding', 'region': 'Berlin, DE', 'email': 'admin@pixelfoundry.gg', 'phone': '+49 30 555 0199',
     'pain': 'Their favourite Minecraft server manager was abandoned in 2024; 40 servers still depend on it.', 'fit': 'High fit · 12k Discord members · Upstream Apache-2',
     'score': 89, 'stage': 'PITCH', 'source': 'Scout: abandoned repo scan', 'notes': 'Fork roadmap drafted. Awaiting Director approval to send.', 'created_at': _ago(14), 'estimatedValue': 900},
    {'id': 'lead-03', 'biz': 'Open Cohort Academy', 'niche': 'Education & Learning', 'region': 'Nairobi, KE', 'email': 'ops@opencohort.africa', 'phone': '+254 20 555 0311',
     'pain': 'Needs an LMS with cohort scheduling, mobile-money payments, and offline lessons — nothing exists in one package.', 'fit': 'Forge candidate · 3 partner schools · grant-funded',
     'score': 91, 'stage': 'CLOSE', 'source': 'Inbound Referral', 'notes': 'Forge proposal sent ($6,000 USD). Open-core: free self-host, paid managed hosting.', 'created_at': _ago(6), 'estimatedValue': 6000},
    {'id': 'lead-04', 'biz': 'Ironbark Plumbing & Gas', 'niche': 'Local Business & Services', 'region': 'Melbourne, AU', 'email': 'dave@ironbarkplumbing.com.au', 'phone': '+61 423 771 904',
     'pain': 'Wants a booking + quoting tool he owns instead of renting; found an open CRM but it needs trade-specific quoting.', 'fit': 'Fast-close Fork candidate',
     'score': 82, 'stage': 'QUALIFY', 'source': 'Opportunity Scan', 'notes': 'Upstream open CRM (MIT) identified. QUALIFIER recommended Fork package.', 'created_at': _ago(3), 'estimatedValue': 900},
    {'id': 'lead-05', 'biz': 'Tidepool Citizen Science', 'niche': 'Science & Research', 'region': 'Lisbon, PT', 'email': 'data@tidepool.science', 'phone': '+351 21 555 0877',
     'pain': 'Volunteers log marine observations in six different apps; the maintainer graduated and the pipeline broke.', 'fit': 'High fit · 800 active volunteers · Zenodo-backed',
     'score': 87, 'stage': 'SCOUT', 'source': 'Autonomous Scout AGT-01', 'notes': 'Found via GitHub issue thread asking for a maintainer.', 'created_at': _ago(1), 'estimatedValue': 2400},
]

CLIENTS = [
    {'id': 'client-01', 'biz': 'Trailhead Collective', 'package': 'Merge', 'setup_fee': 2400, 'setup_paid': True, 'tier': 'Upstream', 'mrr': 900, 'status': 'BUILDING', 'build_pct': 72,
     'health': 'GREEN', 'created_via': 'PAYPAL', 'created_at': _ago(72), 'techStack': ['Next.js', 'Postgres', 'Stripe', 'Discord'], 'primaryContact': 'Maya Ortiz (Club President)',
     'deliverables': ['Trip planner and gear-share repos merged', 'Stripe membership dues wired', 'Discord roster sync tested', 'README and contributor guide in progress']},
    {'id': 'client-02', 'biz': 'Loomcraft Patterns', 'package': 'Fork', 'setup_fee': 900, 'setup_paid': True, 'tier': 'Maintain', 'mrr': 300, 'status': 'LIVE', 'build_pct': 100,
     'health': 'GREEN', 'created_via': 'SOLANA', 'created_at': _ago(180), 'techStack': ['SvelteKit', 'SQLite', 'Stripe'], 'primaryContact': 'Elena Rostova',
     'deliverables': ['Open knitting-pattern editor forked and rebranded', 'PDF export and pattern marketplace added', 'Published on GitHub + npm (v1.0.0)']},
    {'id': 'client-03', 'biz': 'Harbour Freight Co-op', 'package': 'Forge', 'setup_fee': 6000, 'setup_paid': True, 'tier': 'Steward', 'mrr': 2200, 'status': 'LIVE', 'build_pct': 100,
     'health': 'GREEN', 'created_via': 'CARD', 'created_at': _ago(300), 'techStack': ['Go', 'PostgreSQL', 'React', 'Docker'], 'primaryContact': 'Brett Higgins (Operations Head)',
     'deliverables': ['Open-source consignment tracker built from scratch', 'Driver dispatch and OCR modules', 'Open-core: self-host free, managed cloud paid', '31 external contributors onboarded']},
    {'id': 'client-04', 'biz': 'Solstice Homebrew Guild', 'package': 'Merge', 'setup_fee': 2400, 'setup_paid': True, 'tier': 'Upstream', 'mrr': 900, 'status': 'QUEUED', 'build_pct': 8,
     'health': 'GREEN', 'created_via': 'SOLANA', 'created_at': _ago(96), 'techStack': ['Remix', 'SQLite', 'Solana Pay'], 'primaryContact': 'Jonas Feld',
     'deliverables': ['Recipe + inventory repos selected', 'Solana Pay dues wired', 'Brew-day scheduler scoped']},
]

APPROVALS = [
    {'id': 'appr-01', 'type': 'OUTREACH_PITCH', 'title': 'Fork Roadmap: Pixel Foundry Servers', 'agent': 'PITCHER', 'status': 'pending', 'created_at': _ago(2),
     'detail': 'PITCHER drafted a $900 USD Fork plan to revive the abandoned server manager with plugin support and a hosted tier.',
     'payload': {'recipient': 'admin@pixelfoundry.gg', 'subject': 'Reviving your server manager as a maintained open-source fork', 'fee': 900, 'mrr': 300, 'timeline': '5 days'}},
    {'id': 'appr-02', 'type': 'BUILD_HANDOVER', 'title': 'Release QA: Trailhead Collective v1.0.0', 'agent': 'SHIPPER', 'status': 'pending', 'created_at': _ago(5),
     'detail': 'SHIPPER passed 14/14 integration tests. Ready for Director sign-off, tag, and public GitHub release.',
     'payload': {'client': 'Trailhead Collective', 'package': 'Merge', 'testsPassed': 14, 'testFailures': 0, 'documentationUrl': 'https://github.com/yabbai-forge/trailhead/releases/tag/v1.0.0'}},
    {'id': 'appr-03', 'type': 'LICENSE_CHECK', 'title': 'Upstream Audit: Trip-planner Base Repo', 'agent': 'FORGE', 'status': 'approved', 'created_at': _ago(12),
     'license': 'MIT', 'license_class': 'Resale Clean',
     'detail': 'FORGE inspected the upstream trip-planner and its 41 dependencies. No copyleft contamination. Resale permitted.',
     'payload': {'library': 'open-trip-planner', 'version': '2.3.0', 'permittedUse': 'Fork, rebrand, and commercial redistribution allowed'}},
]

PAYMENTS = [
    {'id': 'pay-01', 'method': 'PAYPAL', 'purpose': 'Merge Package Build', 'biz': 'Trailhead Collective', 'package': 'Merge', 'tier': 'Upstream', 'amount_usd': 2400, 'mrr': 900,
     'reference': 'PP-ORD-8829104', 'status': 'confirmed', 'client_id': 'client-01', 'created_at': _ago(72), 'simulated': True},
    {'id': 'pay-02', 'method': 'SOLANA', 'purpose': 'Fork Package Build (On-chain)', 'biz': 'Loomcraft Patterns', 'package': 'Fork', 'tier': 'Maintain', 'amount_usd': 900, 'mrr': 300,
     'sol_amount': 4.74, 'recipient': SOL_RECIPIENT, 'reference': '5KmN8j...7X9q (Slot #288419201)', 'status': 'confirmed', 'client_id': 'client-02', 'created_at': _ago(180), 'simulated': True},
    {'id': 'pay-03', 'method': 'CARD', 'purpose': 'Forge Package Build', 'biz': 'Harbour Freight Co-op', 'package': 'Forge', 'tier': 'Steward', 'amount_usd': 6000, 'mrr': 2200,
     'reference': 'TXN-STR-994120', 'status': 'confirmed', 'client_id': 'client-03', 'created_at': _ago(300), 'simulated': True},
    {'id': 'pay-04', 'method': 'SOLANA', 'purpose': 'Merge Package Build (On-chain Escrow)', 'biz': 'Solstice Homebrew Guild', 'package': 'Merge', 'tier': 'Upstream', 'amount_usd': 2400, 'mrr': 900,
     'sol_amount': 12.63, 'recipient': SOL_RECIPIENT, 'reference': '4xJ8kP...9mQ2 (Slot #288412890)', 'status': 'confirmed', 'client_id': 'client-04', 'created_at': _ago(96), 'simulated': True},
]

WITHDRAWALS = [
    {'id': 'wth-01', 'amount_sol': 1.5, 'amount_usd_est': 285, 'destination_wallet': SOL_RECIPIENT,
     'tx_signature': '4t39fjyTZGijZST5qjFZEwikFXwfifdhqYHjDV82LFuHi31rxnj3rP7UtxA9LqgYNvfFuWAJ5Nh26P5gz8LDpUqi', 'status': 'confirmed',
     'memo': 'Director Operational Sweep · Hot Reserve', 'priority_fee_sol': 0.000005, 'created_at': _ago(36), 'tx_mode': 'onchain', 'slot': 445763810, 'verified_onchain': True},
]

EVENTS = [
    {'id': 'ev-01', 'cycle_n': 42, 'agent': 'SCOUT', 'severity': 'normal', 'created_at': _ago(1.5),
     'message': 'Scanned 3,100 GitHub repos tagged recreation, gaming, education. Flagged 14 abandoned projects with active issue threads asking for a maintainer.'},
    {'id': 'ev-02', 'cycle_n': 42, 'agent': 'QUALIFIER', 'severity': 'normal', 'created_at': _ago(1.1),
     'message': 'Scored Ironbark Plumbing fit: 82/100. Upstream open CRM is MIT, 2.1k stars, last commit 3 weeks ago.'},
    {'id': 'ev-03', 'cycle_n': 42, 'agent': 'PITCHER', 'severity': 'gate', 'created_at': _ago(0.8),
     'message': 'Amber Gate Triggered: Fork roadmap drafted for Pixel Foundry Servers. Awaiting Director approval.'},
    {'id': 'ev-04', 'cycle_n': 41, 'agent': 'TREASURER', 'severity': 'success', 'created_at': _ago(2.5),
     'message': 'Verified Solana tx signature: 4.74 SOL deposited to HTN1fv...V5i. Ledger updated: +$900 USD.'},
    {'id': 'ev-05', 'cycle_n': 41, 'agent': 'SHIPPER', 'severity': 'normal', 'created_at': _ago(3.2),
     'message': 'Staging build deployed for Trailhead Collective. All 14 integration tests passed. Release candidate tagged.'},
]


async def ensure_seed():
    if await db.leads.count_documents({}) == 0:
        await db.leads.insert_many([dict(d) for d in LEADS])
        await db.clients.insert_many([dict(d) for d in CLIENTS])
        await db.approvals.insert_many([dict(d) for d in APPROVALS])
        await db.payments.insert_many([dict(d) for d in PAYMENTS])
        await db.withdrawals.insert_many([dict(d) for d in WITHDRAWALS])
        await db.events.insert_many([dict(d) for d in EVENTS])
        log.info('seeded core collections')
    await get_app_state()
    await flywheel.get_config()
    await flywheel.get_state()
    if await db.flywheel_ledger.count_documents({}) == 0:
        for p in PAYMENTS:
            try:
                await flywheel.allocate_from_payment(p)
            except Exception as e:
                log.warning('seed allocation failed for %s: %s', p['id'], e)
        log.info('seeded flywheel from historical payments')
