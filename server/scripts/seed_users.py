"""Create a bootstrap admin + staff user for local development."""

from sqlmodel import Session, select

from app.core.security import hash_password
from app.db.session import engine
from app.models.user import User, UserRole

SEED_USERS = [
    {
        "email": "admin@physiodesk.com",
        "full_name": "Clinic Admin",
        "password": "Admin123!",
        "role": UserRole.ADMIN,
    },
    {
        "email": "staff@physiodesk.com",
        "full_name": "Front Desk Staff",
        "password": "Staff123!",
        "role": UserRole.STAFF,
    },
]


def seed() -> None:
    with Session(engine) as session:
        for item in SEED_USERS:
            existing = session.exec(
                select(User).where(User.email == item["email"])
            ).first()
            if existing:
                print(f"skip existing: {item['email']}")
                continue

            user = User(
                email=item["email"],
                full_name=item["full_name"],
                hashed_password=hash_password(item["password"]),
                role=item["role"],
                is_active=True,
            )
            session.add(user)
            print(f"created: {item['email']} ({item['role'].value})")

        session.commit()


if __name__ == "__main__":
    seed()
