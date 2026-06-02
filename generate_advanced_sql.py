import json
import sys

def escape_sql(text):
    return text.replace("'", "''")

levels = ["B2", "C1", "C2"]

themes = {
    "B2": [
        ("Public Speaking", "Techniques for delivering powerful presentations and managing Q&A sessions."),
        ("Crisis Management", "Vocabulary for handling business emergencies and communication breakdowns."),
        ("Corporate Social Responsibility", "Discussing sustainability, ethics, and community impact."),
        ("Innovation and R&D", "Phrasal verbs for research: 'look into', 'test out', 'come up with'."),
        ("Team Leadership", "Phrasal verbs for leading: 'take over', 'hand off', 'step in'."),
        ("Global Logistics", "Managing international supply chains and trade regulations."),
        ("Consumer Behavior", "Analyzing trends and psychological factors in marketing."),
        ("Risk Assessment", "Evaluating potential threats and opportunities in business ventures."),
        ("Conflict Resolution", "Strategies and language for mediating disputes in the workplace."),
        ("Supply Chain Optimization", "Advanced vocabulary for efficiency and cost reduction."),
        ("Brand Identity", "Developing and maintaining a strong company image."),
        ("Economic Trends", "Discussing market fluctuations and financial forecasting.")
    ],
    "C1": [
        ("Geopolitical Impact", "How world events affect global markets and business strategies."),
        ("Venture Capital", "Advanced financial discussions on investments and startup funding."),
        ("Ethical Leadership", "Complex debates on corporate responsibility and moral dilemmas."),
        ("Artificial Intelligence", "Discussing the impact of AI on various industries and society."),
        ("Sustainable Development", "In-depth analysis of environmental policies and business adaptation."),
        ("Mergers and Acquisitions", "Vocabulary for complex corporate restructuring and deals."),
        ("Behavioral Economics", "Applying psychological insights to economic decision-making."),
        ("Strategic Negotiation", "Nuanced language for high-stakes business agreements."),
        ("Organizational Culture", "Analyzing the underlying values and behaviors in a company."),
        ("Data-Driven Decisions", "Using analytics to guide business strategy and operations."),
        ("Global Trade Relations", "Discussing tariffs, trade agreements, and international diplomacy."),
        ("Future of Work", "Trends in remote work, automation, and the gig economy.")
    ],
    "C2": [
        ("Philosophical Business Ethics", "Deep dive into the underlying principles of corporate morality."),
        ("Macroeconomic Systems", "Analyzing the complex interactions within global economies."),
        ("Sociological Business Impacts", "How businesses shape and are shaped by societal changes."),
        ("Technological Singularity", "Speculative discussions on future tech and its business implications."),
        ("Abstract Strategic Theory", "High-level concepts in business strategy and competitive advantage."),
        ("Cognitive Biases in Finance", "Identifying and mitigating mental shortcuts in financial markets."),
        ("Cross-Cultural Diplomacy", "Nuanced communication for international business and politics."),
        ("Legal Jurisprudence", "Discussing the intersection of law, business, and ethics."),
        ("Meta-Analysis of Markets", "Evaluating the theories and models used to understand economics."),
        ("Sustainable Philanthropy", "Advanced discussions on corporate giving and social impact."),
        ("Innovation Management", "Theoretical frameworks for fostering a culture of creativity."),
        ("Global Governance", "The role of international organizations in business and society.")
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
    content = {
        "part1": {"image_url": image_url, "options": [{"script": f"A scene depicting {title.lower()}."}, {"script": "Working in an office."}, {"script": "Waiting at the station."}], "correct_index": 0},
        "part2": [{"question_script": f"Topic of {title.lower()}?", "options": [{"script": "About " + title.lower()}, {"script": "About cooking"}, {"script": "About weather"}], "correct_index": 0}, {"question_script": "When to talk about it?", "options": [{"script": "Raining"}, {"script": "Professional/travel"}, {"script": "Night"}], "correct_index": 1}, {"question_script": "Is it difficult?", "options": [{"script": "Need practice"}, {"script": "Sleeping"}, {"script": "Monday"}], "correct_index": 0}],
        "part3": {"dialogue": [{"speaker": "A", "text": f"Learning {title.lower()}."}, {"speaker": "B", "text": "Important part."}], "questions": [{"enunciado": "Interested in?", "options": [title, "Other", "Nothing"], "correct_index": 0}, {"enunciado": "Description?", "options": ["Boring", "Important", "Unnecessary"], "correct_index": 1}, {"enunciado": "Next?", "options": ["Example", "Gift", "Ticket"], "correct_index": 0}]},
        "part4": {"script": f"Covered {title.lower()}.", "questions": [{"enunciado": "Focus?", "options": ["Sports", title, "Movies"], "correct_index": 1}, {"enunciado": "Why crucial?", "options": ["Communication", "Sleep", "Food"], "correct_index": 0}, {"enunciado": "Advice?", "options": ["Review", "Forget", "Sleep"], "correct_index": 0}]}
    }
    return content

sql = ""
for level in levels:
    for i, (title, description) in enumerate(themes[level]):
        content = generate_content(title, level, description, i)
        content_json = json.dumps(content)
        sql += f"INSERT INTO listening_lessons (title, level, description, content) VALUES ('{escape_sql(title)}', '{level}', '{escape_sql(description)}', '{escape_sql(content_json)}');\n"

with open("advanced_lessons.sql", "w") as f:
    f.write(sql)
