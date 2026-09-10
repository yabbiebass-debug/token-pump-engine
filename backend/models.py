from typing import Optional, Literal
from pydantic import BaseModel, Field


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


class AutoCycleUpdate(BaseModel):
    auto_cycle: bool


class PaymentCreate(BaseModel):
    biz: str = Field(min_length=1, max_length=120)
    email: str = ''
    phone: str = ''
    package: str = 'Merge'
    custom_fee: Optional[int] = None
    tier: str = 'Upstream'
    method: Literal['card', 'paypal', 'solana'] = 'card'
    scope: str = ''
    promo_code: str = ''
    sol_signature: str = ''


class WithdrawalCreate(BaseModel):
    mode: Literal['simulated', 'attest'] = 'simulated'
    amount_sol: float = Field(gt=0)
    destination_wallet: str = Field(min_length=32, max_length=48)
    memo: str = 'Director Operational Sweep'
    signature: str = ''


class FlywheelConfigUpdate(BaseModel):
    buyback_pct: Optional[float] = Field(default=None, ge=0, le=1)
    stage_tap_pct: Optional[float] = Field(default=None, ge=0, le=0.1)
    hashrate_khs: Optional[float] = Field(default=None, ge=0, le=1e9)
    mined_symbol: Optional[Literal['XMR', 'KAS', 'LTC', 'RVN', 'ETC', 'BTC']] = None
    mined_price_usd: Optional[float] = Field(default=None, ge=0)
    yield_per_khs_hour: Optional[float] = Field(default=None, ge=0)
    conversion_interval_min: Optional[int] = Field(default=None, ge=1, le=1440)
    hourly_capacity_sol: Optional[float] = Field(default=None, ge=0)
    min_injection_sol: Optional[float] = Field(default=None, ge=0)


class AgentDemoRequest(BaseModel):
    agentType: Literal['quoter', 'extractor', 'retention']
    userInput: str = Field(min_length=1, max_length=4000)
    sessionId: str = 'anon'


class VerifySignatureRequest(BaseModel):
    signature: str = Field(min_length=64, max_length=100)
