import json

levels = ["A1", "A2", "B1"]
lessons_per_level = 12

themes = {
    "A1": [
        "Airport Immigration", "Checking in at a Guesthouse", "Beach Kiosk", 
        "Information Counter / Book Fair", "Craft Fair in Guaxupé", "Street Market", 
        "Recyclable Craft Fair", "Sharing Business Values", "Multinational Factory Welcome", 
        "Factory Tour", "Safety Protocols", "Suppliers at Reception"
    ],
    "A2": [
        "Renting Room (AirBnB)", "Minas Gerais Cuisine", "Renting Bikes/Scooters", 
        "Emergency at Dentist", "Cultural Experience in Belém", "Renting Climbing Gear", 
        "Natural Products (Mato Grosso)", "Artisanal Products (Ceará)", "Hotel Complaints", 
        "Job Interview", "Business Presentation", "Travel Planning"
    ],
    "B1": [
        "Professional Meetings", "Travel Networking", "Sales Negotiation", 
        "Digital Marketing Basics", "Office Socializing", "Project Management", 
        "Customer Support Phrasal Verbs", "Financial Discussions", "Hiring and Firing", 
        "Company Strategy", "Workshop Facilitation", "Business Travel Logistics"
    ]
}

# This is a template generator. In a real scenario, I'd need actual content.
# I will ask the subagent to fill this with real content.
