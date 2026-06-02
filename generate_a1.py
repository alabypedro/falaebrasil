
import json
import uuid

def generate_a1():
    lessons = [
        {
            "title": "Airport Immigration",
            "level": "A1",
            "description": "Handling questions and procedures at airport immigration.",
            "content": {
                "part1": {
                    "image_url": "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&q=80&w=800",
                    "options": [
                        {"script": "The officer is checking the traveler's passport."},
                        {"script": "The pilot is flying the airplane."},
                        {"script": "The tourist is buying a suitcase."}
                    ],
                    "correct_index": 0
                },
                "part2": [
                    {
                        "question_script": "What is the purpose of your visit?",
                        "options": [
                            {"script": "I am a doctor."},
                            {"script": "I am here for tourism."},
                            {"script": "I have two bags."}
                        ],
                        "correct_index": 1
                    },
                    {
                        "question_script": "How long are you planning to stay?",
                        "options": [
                            {"script": "At the Hilton Hotel."},
                            {"script": "For two weeks."},
                            {"script": "With my brother."}
                        ],
                        "correct_index": 1
                    },
                    {
                        "question_script": "Where will you be staying?",
                        "options": [
                            {"script": "In a guesthouse downtown."},
                            {"script": "Tomorrow morning."},
                            {"script": "By taxi."}
                        ],
                        "correct_index": 0
                    }
                ],
                "part3": {
                    "dialogue": [
                        {"speaker": "Officer", "text": "Good morning. Passport, please."},
                        {"speaker": "Traveler", "text": "Here it is. I'm visiting for a conference."},
                        {"speaker": "Officer", "text": "How long is the conference?"},
                        {"speaker": "Traveler", "text": "It lasts for five days. Then I'll return home."}
                    ],
                    "questions": [
                        {
                            "enunciado": "What does the officer ask for first?",
                            "options": ["A ticket", "A passport", "A bag"],
                            "correct_index": 1
                        },
                        {
                            "enunciado": "Why is the traveler visiting?",
                            "options": ["For a holiday", "For a conference", "To see family"],
                            "correct_index": 1
                        },
                        {
                            "enunciado": "How long is the conference?",
                            "options": ["Two days", "Five days", "One week"],
                            "correct_index": 1
                        }
                    ]
                },
                "part4": {
                    "script": "Welcome to the international airport. Please have your documents ready. All visitors must show their passport and visa. If you have nothing to declare, please follow the green line. Enjoy your stay in our country.",
                    "questions": [
                        {
                            "enunciado": "What documents should visitors have ready?",
                            "options": ["Passport and visa", "ID card only", "Hotel booking"],
                            "correct_index": 0
                        },
                        {
                            "enunciado": "Which line should you follow if you have nothing to declare?",
                            "options": ["The red line", "The green line", "The blue line"],
                            "correct_index": 1
                        },
                        {
                            "enunciado": "What is the main purpose of this announcement?",
                            "options": ["To sell tickets", "To give instructions", "To announce a flight delay"],
                            "correct_index": 1
                        }
                    ]
                }
            }
        },
        # ... more lessons will be added here in the actual generation
    ]
    return lessons

# I will write a more comprehensive generator script that covers all 36.
