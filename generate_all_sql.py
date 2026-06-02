import json
import random

def escape_sql(text):
    return text.replace("'", "''")

levels = ["A1", "A2", "B1"]

themes = {
    "A1": [
        ("Airport Immigration", "Handling questions and procedures at airport immigration."),
        ("Checking in at a Guesthouse", "Practice listening skills related to hotel check-ins and welcoming tourists."),
        ("Beach Kiosk", "Ordering drinks and snacks at a beach kiosk."),
        ("Information Counter", "Asking for directions and travel information at a bus station."),
        ("Craft Fair", "Buying handmade items and discussing sustainable products."),
        ("Street Market", "Shopping for fresh produce and interacting with vendors."),
        ("Recyclable Craft Fair", "Learning about recycled crafts and sustainable business practices."),
        ("Sharing Business Values", "Talking about mission, vision, and values in a small business."),
        ("Multinational Factory Welcome", "Welcoming international visitors to a large factory."),
        ("Factory Tour", "Following a guided tour through different factory sectors."),
        ("Safety Protocols", "Understanding safety rules and emergency procedures in a factory."),
        ("Suppliers at Reception", "Interacting with delivery drivers and suppliers at a factory entrance.")
    ],
    "A2": [
        ("AirBnB Renting", "Communicating with hosts and guests in an AirBnB setting."),
        ("Minas Gerais Cuisine", "Discussing traditional food and cooking from Minas Gerais."),
        ("Bike Rental", "Renting bicycles and scooters at the beachfront."),
        ("Dentist Emergency", "Handling a dental emergency while on vacation."),
        ("Ver-O-Peso Market", "Exploring the flavors and history of the Amazon at the Ver-O-Peso market."),
        ("Climbing Gear", "Renting equipment for hiking and rock climbing."),
        ("Natural Products", "Discovering natural products from the Mato Grosso region."),
        ("Artisanal Products", "Learning about traditional crafts and products from Ceará."),
        ("Hotel Complaints", "Reporting issues and making complaints at a hotel front desk."),
        ("Job Interview", "Common questions and answers in a basic job interview."),
        ("Business Presentation", "Understanding the structure and main points of a business presentation."),
        ("Travel Planning", "Discussing itineraries, bookings, and travel arrangements.")
    ],
    "B1": [
        ("Professional Meetings", "Using phrasal verbs like 'bring up', 'look into', and 'follow up' in meetings."),
        ("Travel Networking", "Making professional connections while traveling for business."),
        ("Sales Negotiation", "Phrasal verbs for closing deals: 'back out', 'come down', 'sign off'."),
        ("Digital Marketing Basics", "Discussing marketing strategies and social media campaigns."),
        ("Office Socializing", "Small talk and informal language in a professional environment."),
        ("Project Management", "Phrasal verbs for projects: 'kick off', 'run into', 'wrap up'."),
        ("Customer Support", "Handling difficult customers and resolving issues effectively."),
        ("Financial Discussions", "Discussing budgets, costs, and financial reports."),
        ("Hiring and Firing", "Vocabulary and phrasal verbs related to human resources."),
        ("Company Strategy", "Discussing long-term goals and market positioning."),
        ("Workshop Facilitation", "Leading and participating in professional training sessions."),
        ("Business Travel Logistics", "Managing complex travel schedules and international logistics.")
    ]
}

images = [
    "https://images.unsplash.com/photo-1542296332-2e4473faf563",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945",
    "https://images.unsplash.com/photo-1523731407965-2430cd12f5e4",
    "https://images.unsplash.com/photo-1493246507139-91e8bef99c02",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158",
    "https://images.unsplash.com/photo-1581092160562-40aa08e78837",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d"
]

def generate_content(title, level, description, idx):
    image_url = images[idx % len(images)] + "?auto=format&fit=crop&q=80&w=800"
    
    # Generic template but with title-specific text
    content = {
        "part1": {
            "image_url": image_url,
            "options": [
                {"script": f"A scene depicting {title.lower()}."},
                {"script": "A group of people are working in an office."},
                {"script": "A traveler is waiting at the station."}
            ],
            "correct_index": 0
        },
        "part2": [
            {
                "question_script": f"What is the main topic of {title.lower()}?",
                "options": [
                    {"script": "It is about " + title.lower() + "."},
                    {"script": "It's about cooking."},
                    {"script": "It's about the weather."}
                ],
                "correct_index": 0
            },
            {
                "question_script": f"When do we usually talk about {title.lower()}?",
                "options": [
                    {"script": "When it's raining."},
                    {"script": "In professional or travel situations."},
                    {"script": "During the night."}
                ],
                "correct_index": 1
            },
            {
                "question_script": f"Is {title.lower()} difficult for you?",
                "options": [
                    {"script": "Yes, I need to practice."},
                    {"script": "No, I am sleeping."},
                    {"script": "Maybe on Monday."}
                ],
                "correct_index": 0
            }
        ],
        "part3": {
            "dialogue": [
                {"speaker": "Person A", "text": f"Hi! I'm here to learn about {title.lower()}."},
                {"speaker": "Person B", "text": f"That's great! {title} is a very important part of our course."},
                {"speaker": "Person A", "text": "Can you give me an example?"},
                {"speaker": "Person B", "text": f"Sure, when you are in {description.lower()}, you use specific vocabulary."}
            ],
            "questions": [
                {
                    "enunciado": f"What is Person A interested in?",
                    "options": [title, "A different subject", "Nothing"],
                    "correct_index": 0
                },
                {
                    "enunciado": "How does Person B describe this topic?",
                    "options": ["Boring", "Important", "Unnecessary"],
                    "correct_index": 1
                },
                {
                    "enunciado": "What will Person B provide?",
                    "options": ["An example", "A gift", "A ticket"],
                    "correct_index": 0
                }
            ]
        },
        "part4": {
            "script": f"This lesson covered {title.lower()}. We discussed {description.lower()} Understanding these concepts is crucial for effective communication in English. Make sure to review the key phrases and use them in your daily life.",
            "questions": [
                {
                    "enunciado": "What was the focus of this lesson?",
                    "options": ["Sports", title, "Movies"],
                    "correct_index": 1
                },
                {
                    "enunciado": "Why is this understanding crucial?",
                    "options": ["For communication", "For sleeping", "For eating"],
                    "correct_index": 0
                },
                {
                    "enunciado": "What is the final advice?",
                    "options": ["Review key phrases", "Forget everything", "Go to sleep"],
                    "correct_index": 0
                }
            ]
        }
    }
    return content

sql = "DELETE FROM listening_lessons;\n"
for level in levels:
    for i, (title, description) in enumerate(themes[level]):
        content = generate_content(title, level, description, i)
        content_json = json.dumps(content)
        sql += f"INSERT INTO listening_lessons (title, level, description, content) VALUES ('{escape_sql(title)}', '{level}', '{escape_sql(description)}', '{escape_sql(content_json)}');\n"

with open("all_lessons.sql", "w") as f:
    f.write(sql)
