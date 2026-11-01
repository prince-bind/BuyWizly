from pydantic import BaseModel, EmailStr, Field


class Register(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Login(BaseModel):
    email: EmailStr
    password: str


class CartUpdate(BaseModel):
    product_id: str
    quantity: int = 1


class Address(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    line1: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    pincode: str = Field(pattern=r"^\d{6}$")
    phone: str = Field(pattern=r"^\d{10}$")


class Checkout(BaseModel):
    address: Address
    payment_method: str = Field(default="COD", pattern="^(COD|UPI|CARD)$")
    coupon_code: str | None = None


class Quote(BaseModel):
    coupon_code: str | None = None


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str = Field(default="", max_length=120)
    body: str = Field(default="", max_length=2000)


class ReturnIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class Ask(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: str | None = None


class Feedback(BaseModel):
    log_id: int
    rating: int = Field(ge=-1, le=1)


class CompareIn(BaseModel):
    product_ids: list[str] = Field(min_length=2, max_length=3)
