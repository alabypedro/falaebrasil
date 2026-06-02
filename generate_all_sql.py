import json

def escape_sql(text):
    return text.replace("'", "''")

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

def generate_content(title, level, description):
    # This function generates a simplified version of content for each theme.
    # In a real scenario, this would be much more detailed.
    # For now, I'll generate unique but structured content for each.
    
    # Generic template but with title-specific text
    content = {
        "part1": {
            "image_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=800",
            "options": [
                {"script": f"A person is talking about {title.lower()}."},
                {"script": "A group of people are working in an office."},
                {"script": "A traveler is waiting at the station."}
            ],
            "correct_index": 0
        },
        "part2": [
            {
                "question_script": f"How do you feel about {title.lower()}?",
                "options": [
                    {"script": "It is very interesting."},
                    {"script": "I don't like coffee."},
                    {"script": "It's 5 o'clock."}
                ],
                "correct_index": 0
            },
            {
                "question_script": f"When did you start with {title.lower()}?",
                "options": [
                    {"script": "Last year."},
                    {"script": "In London."},
                    {"script": "By car."}
                ],
                "correct_index": 0
            },
            {
                "question_script": "Is it difficult?",
                "options": [
                    {"script": "Yes, sometimes."},
                    {"script": "No, I am a student."},
                    {"script": "Maybe tomorrow."}
                ],
                "correct_index": 0
            }
        ],
        "part3": {
            "dialogue": [
                {"speaker": "A", "text": f"Hi, I want to learn more about {title.lower()}."},
                {"speaker": "B", "text": f"Sure! {title} is very important for our business."},
                {"speaker": "A", "text": "Can you show me how it works?"},
                {"speaker": "B", "text": "Yes, let's look at this together."}
            ],
            "questions": [
                {
                    "enunciado": f"What does A want to learn about?",
                    "options": [title, "Something else", "Nothing"],
                    "correct_index": 0
                },
                {
                    "enunciado": "Is it important for the business?",
                    "options": ["Yes", "No", "They don't know"],
                    "correct_index": 0
                },
                {
                    "enunciado": "What will they do next?",
                    "options": ["Look at it together", "Go home", "Eat lunch"],
                    "correct_index": 0
                }
            ]
        },
        "part4": {
            "script": f"In this lesson about {title.lower()}, we learned that {description.lower()} It is essential for anyone who wants to improve their English skills in a professional or travel context. Remember to practice the new vocabulary every day.",
            "questions": [
                {
                    "enunciado": "What was the lesson about?",
                    "options": [title, "Cooking", "Sports"],
                    "correct_index": 0
                },
                {
                    "enunciado": "Is this essential for English learners?",
                    "options": ["Yes", "No", "Maybe"],
                    "correct_index": 0
                },
                {
                    "enunciado": "What should you do every day?",
                    "options": ["Practice vocabulary", "Sleep more", "Watch TV"],
                    "correct_index": 0
                }
            ]
        }
    }
    return content

sql = "DELETE FROM listening_lessons;\n"
for level in levels:
    for i, (title, description) in enumerate(themes[level]):
        content = generate_content(title, level, description)
        content_json = json.dumps(content)
        sql += f"INSERT INTO listening_lessons (title, level, description, content) VALUES ('{escape_sql(title)}', '{level}', '{escape_sql(description)}', '{escape_sql(content_json)}');\n"

with open("all_lessons.sql", "w") as f:
    f.write(sql)
