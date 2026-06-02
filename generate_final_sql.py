import json

def escape_sql(text):
    return text.replace("'", "''")

levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
themes = {
    "A1": [("Airport Immigration", "Handling procedures."), ("Checking in", "Guesthouse check-in."), ("Beach Kiosk", "Ordering snacks."), ("Information", "Asking directions."), ("Craft Fair", "Handmade items."), ("Street Market", "Shopping."), ("Recyclables", "Sustainable crafts."), ("Values", "Business mission."), ("Welcome", "Factory welcome."), ("Factory Tour", "Guided tour."), ("Safety", "Factory protocols."), ("Suppliers", "Reception desk.")],
    "A2": [("AirBnB", "Host communication."), ("Cuisine", "Traditional food."), ("Bikes", "Beachfront rental."), ("Dentist", "Holiday emergency."), ("Ver-O-Peso", "Amazon market."), ("Climbing", "Gear rental."), ("Natural", "Regional products."), ("Artisanal", "Traditional crafts."), ("Complaints", "Hotel front desk."), ("Interview", "Job basics."), ("Presentation", "Business talk."), ("Planning", "Travel plans.")],
    "B1": [("Meetings", "Professional talk."), ("Networking", "Travel connections."), ("Sales", "Closing deals."), ("Marketing", "Digital strategy."), ("Socializing", "Office talk."), ("Project", "Management phrasals."), ("Support", "Customer issues."), ("Finance", "Budget talk."), ("Hiring", "HR vocabulary."), ("Strategy", "Goal setting."), ("Workshop", "Training sessions."), ("Logistics", "Travel schedules.")],
    "B2": [("Public Speaking", "Presentations."), ("Crisis", "Emergency talk."), ("CSR", "Social ethics."), ("R&D", "Innovation."), ("Leadership", "Team leading."), ("Global Logistics", "Supply chains."), ("Consumer", "Marketing trends."), ("Risk", "Business assessment."), ("Conflict", "Mediating disputes."), ("Optimization", "Efficiency."), ("Brand", "Company image."), ("Trends", "Market forecasting.")],
    "C1": [("Geopolitical", "Global markets."), ("Venture Capital", "Funding."), ("Ethical", "Leadership dilemmas."), ("AI", "Industry impact."), ("Sustainability", "Environmental policies."), ("Mergers", "Corporate deals."), ("Behavioral", "Economics."), ("Strategic", "Nuanced negotiation."), ("Culture", "Values."), ("Data", "Decision making."), ("Trade", "Diplomacy."), ("Future", "Work trends.")],
    "C2": [("Philosophy", "Morality."), ("Macroeconomic", "Global systems."), ("Sociological", "Impact."), ("Singularity", "Future tech."), ("Abstract", "Strategy theory."), ("Biases", "Financial shortcuts."), ("Diplomacy", "Cross-cultural."), ("Jurisprudence", "Legal intersection."), ("Meta-Analysis", "Theory."), ("Philanthropy", "Social impact."), ("Creative", "Innovation frameworks."), ("Governance", "Global role.")],
}

sql = "DELETE FROM listening_lessons;\n"
sql += "INSERT INTO listening_lessons (title, level, description, content) VALUES \n"
all_values = []
for level in levels:
    for i, (title, description) in enumerate(themes[level]):
        content = {
            "part1": {"image_url": "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&q=80&w=800", "options": [{"script": f"{title} Scene"}], "correct_index": 0},
            "part2": [{"question_script": f"Question about {title}?", "options": [{"script": "Correct response"}], "correct_index": 0}] * 3,
            "part3": {"dialogue": [{"speaker": "male", "text": "Line 1"}, {"speaker": "female", "text": "Line 2"}], "questions": [{"enunciado": f"Dialogue Q for {title}?", "options": ["Option A", "Option B", "Option C"], "correct_index": 0}] * 3},
            "part4": {"script": f"Short lecture on {title}.", "questions": [{"enunciado": f"Lecture Q for {title}?", "options": ["Option A", "Option B", "Option C"], "correct_index": 0}] * 3}
        }
        all_values.append(f"('{escape_sql(title)}', '{level}', '{escape_sql(description)}', '{escape_sql(json.dumps(content))}')")

sql += ",\n".join(all_values) + ";"
with open("populate.sql", "w") as f:
    f.write(sql)
