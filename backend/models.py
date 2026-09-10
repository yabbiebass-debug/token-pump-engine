from typing import Optional, Literal, Dict
from pydantic import BaseModel, Field

SIGNATURE_RE = r'^[1-9A-HJ-NP-Za-km-z]{64,100}$'


class LeadCreate(BaseModel):
    biz: str = Field(min_length=1, max_length=120)
    email: str = ''
    phone: str = ''
    niche: str = 'Recreation & Outdoors'
    region: str = 'Worldwide'
    pain: str = ''
    source: str = 'Director Manual Inject'
    estimatedValue: int = 2400


class LeadStageUpdate(BaseModel):
    stage: Literal['SCOUT', 'QUALIFY', 'PITCH', 'CLOSE', 'BUILD', 'SHIP', 'SUPPORT', 'LOST']


class ClientUpdate(BaseModel):
    status: Optional[Literal['QUEUED', 'BUILDING', 'TESTING', 'LIVE', 'NEEDS_ATTENTION']] = None
    build_pct: Optional[int] = Field(default=None, ge=0, le=100)
    health: Optional[Literal['GREEN', 'AMBER', 'RED']] = None


class AutoCycleUpdate(BaseModel):
    auto_cycle: bool


class PaymentCreate(BaseModel):
    biz: str = Field(min_length=1, max_length=120)
    email: str = ''
    phone: str = ''
    package: str = 'Merge'
    custom_fee: Optional[int] = None
    tier: str = 'Upstream'
    scope: str = ''
    promo_code: str = ''
    sol_signature: str = Field(pattern=SIGNATURE_RE)
    payer_wallet: str = ''


class WithdrawalCreate(BaseModel):
    signature: str = Field(pattern=SIGNATURE_RE)
    memo: str = 'Director treasury transfer'


class FlywheelConfigUpdate(BaseModel):
    signer_wallet: Optional[str] = Field(default=None, min_length=32, max_length=48)
    min_wallet_balance_sol: Optional[float] = Field(default=None, ge=0, le=100)
    max_slippage_bps: Optional[int] = Field(default=None, ge=10, le=2000)
    buyback_pct: Optional[float] = Field(default=None, ge=0, le=1)
    window_min: Optional[int] = Field(default=None, ge=1, le=1440)
    hourly_capacity_sol: Optional[float] = Field(default=None, ge=0)
    min_injection_sol: Optional[float] = Field(default=None, ge=0)
    mining_share_pct: Optional[float] = Field(default=None, ge=0, le=1)
    mining_hashrates: Optional[Dict[str, float]] = None


class AgentDemoRequest(BaseModel):
    agentType: Literal['quoter', 'extractor', 'retention']
    userInput: str = Field(min_length=1, max_length=4000)
    sessionId: str = 'anon'


class VerifySignatureRequest(BaseModel):
    signature: str = Field(min_length=64, max_length=100)
