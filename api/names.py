"""Fictional, deterministic names for the dataset's anonymous employee IDs."""

import random

FIRST = [
    "Aisha", "Daniel", "Mei", "Samuel", "Priyanka", "Lucas", "Fatima", "Noah", "Hana", "Omar",
    "Sofia", "Kwame", "Elena", "Ravi", "Grace", "Mateo", "Yuki", "Ibrahim", "Chloe", "Arjun",
    "Nadia", "Ethan", "Leila", "Tomas", "Zara", "Kenji", "Amara", "Diego", "Ingrid", "Samir",
    "Olivia", "Chen", "Maya", "Jonas", "Ama", "Rafael", "Anya", "Tariq", "Freya", "Vikram",
    "Lina", "Marcus", "Sakura", "Emeka", "Clara", "Hugo", "Divya", "Pablo", "Nora", "Kofi",
    "Isla", "Hassan", "Rosa", "Felix", "Ayesha", "Leo", "Mira", "Jamal", "Elif", "Oscar",
]
LAST = [
    "Ortiz", "Tan", "Okafor", "Nair", "Fischer", "Haddad", "Kowalski", "Mensah", "Sato",
    "Rahman", "Lindqvist", "Moreau", "Silva", "Kapoor", "Novak", "Adeyemi", "Park", "Rossi",
    "Ivanova", "Mbeki", "Hughes", "Santos", "Yilmaz", "Bauer", "Chowdhury", "Laurent", "Kim",
    "Petrov", "Osei", "Duarte", "Nakamura", "Ahmed", "Brennan", "Castillo", "Wisniewska",
    "Patel", "Andersen", "Abubakar", "Reyes", "Horvat", "Iyer", "Schmidt", "Varga", "Mwangi",
    "Lopez", "Takahashi", "Farouk", "Olsen", "Banerjee", "Costa", "Dubois", "Nguyen", "Owusu",
    "Jensen", "Mehta", "Romero", "Kaur", "Wright", "Sokolov", "Achebe",
]


def name_for(employee_id: int) -> str:
    rng = random.Random(employee_id * 7919 + 17)
    return f"{rng.choice(FIRST)} {rng.choice(LAST)}"
