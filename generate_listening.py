import json

# Temas baseados no conteúdo dos cursos (Multinacionais, Turismo, Empreendedorismo)
themes = [
    "International Business", "Hotel Management", "Startups in Brazil", 
    "Customer Service", "Airport Logistics", "Product Innovation",
    "Digital Marketing", "Sustainable Tourism", "Global Logistics",
    "Team Leadership", "E-commerce Trends", "Financial Planning"
]

levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

def generate_content(level, unit_num, theme):
    # Parte 1: Foto (1 Questão)
    p1 = {
        "image_url": f"https://source.unsplash.com/800x600/?{theme.replace(' ', ',')}",
        "options": [
            {"text": f"A person is discussing {theme.lower()} in a meeting.", "is_correct": True},
            {"text": f"Someone is working alone on a {theme.lower()} project.", "is_correct": False},
            {"text": f"A group of people are laughing outdoors.", "is_correct": False}
        ]
    }
    
    # Parte 2: Q&A (3 Questões)
    p2 = [
        {
            "script": f"How often do you deal with {theme.lower()}?",
            "options": [
                {"text": "Every single day.", "is_correct": True},
                {"text": "I don't like coffee.", "is_correct": False},
                {"text": "It's about 5 kilometers away.", "is_correct": False}
            ]
        } for i in range(3)
    ]
    
    # Parte 3: Diálogo (3 Questões)
    p3 = {
        "script": f"Speaker A: I think our strategy for {theme.lower()} needs to change.\nSpeaker B: I agree. We should focus more on efficiency.\nSpeaker A: Let's schedule a meeting for tomorrow morning.",
        "questions": [
            {
                "enunciado": "What are they discussing?",
                "options": [
                    {"text": f"A change in {theme.lower()} strategy.", "is_correct": True},
                    {"text": "A new office location.", "is_correct": False},
                    {"text": "Their lunch plans.", "is_correct": False}
                ]
            } for i in range(3)
        ]
    }
    
    # Parte 4: Dissertação (3 Questões)
    p4 = {
        "script": f"In today's global market, {theme} has become a cornerstone of success. Companies that invest in proper training and technology often see a 20% increase in productivity. However, the human element remains the most important factor in long-term growth.",
        "questions": [
            {
                "enunciado": f"What is the main topic of the talk?",
                "options": [
                    {"text": f"The importance of {theme}.", "is_correct": True},
                    {"text": "The history of the internet.", "is_correct": False},
                    {"text": "How to cook a traditional meal.", "is_correct": False}
                ]
            } for i in range(3)
        ]
    }
    
    return {
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "p4": p4
    }

sql_lines = []
for level in levels:
    for i in range(12):
        theme = themes[i % len(themes)]
        content = generate_content(level, i + 1, theme)
        title = f"Lesson {i+1:02d} - {theme}"
        desc = f"Listening practice for {level} level focusing on {theme}."
        
        # Escaping single quotes for SQL
        content_json = json.dumps(content).replace("'", "''")
        sql = f"INSERT INTO listening_lessons (title, level, description, content) VALUES ('{title}', '{level}', '{desc}', '{content_json}');"
        sql_lines.append(sql)

with open("seed_listening.sql", "w") as f:
    f.write("\n".join(sql_lines))

