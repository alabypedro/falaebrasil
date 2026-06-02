
DELETE FROM listening_lessons;

INSERT INTO listening_lessons (title, description, level, content) VALUES
(
  'Checking in at a Guesthouse',
  'Practice listening skills related to hotel check-ins and welcoming tourists.',
  'A1',
  '{
    "part1": {
      "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800",
      "options": [
        {"script": "The receptionist is handing a key to the guest at the guesthouse."},
        {"script": "The tourist is eating breakfast at a restaurant."},
        {"script": "The man is driving a car on the highway."}
      ],
      "correct_index": 0
    },
    "part2": [
      {
        "question_script": "Where is the tourist from?",
        "options": [
          {"script": "From Brazil."},
          {"script": "From the Netherlands."},
          {"script": "From the USA."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "How many nights is the guest staying?",
        "options": [
          {"script": "One night."},
          {"script": "Two nights."},
          {"script": "Three nights."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "What time is breakfast served?",
        "options": [
          {"script": "At 7 a.m."},
          {"script": "At 8 a.m."},
          {"script": "At 9 a.m."}
        ],
        "correct_index": 1
      }
    ],
    "part3": {
      "dialogue": [
        {"speaker": "male", "text": "Hello! I am Lucas. Are you Emma from the Netherlands?"},
        {"speaker": "female", "text": "Yes, I am. I am here for my check-in."},
        {"speaker": "male", "text": "Welcome! You are staying for two nights. Here is your key."}
      ],
      "questions": [
        {
          "enunciado": "Who is Lucas helping?",
          "options": ["A colleague", "A tourist", "A family member"],
          "correct_index": 1
        },
        {
          "enunciado": "What is the guest doing now?",
          "options": ["Checking out", "Checking in", "Eating breakfast"],
          "correct_index": 1
        },
        {
          "enunciado": "What does Lucas give to Emma?",
          "options": ["A bag", "A key", "A map"],
          "correct_index": 1
        }
      ]
    },
    "part4": {
      "script": "Lucas is a receptionist at a cozy guesthouse. Today he is welcoming Emma, a visitor from the Netherlands. Emma has a small bag and is staying for two nights. Lucas is very happy to help her with the check-in process and confirms that breakfast will be ready at 8 a.m. tomorrow.",
      "questions": [
        {
          "enunciado": "What is the guesthouse receptionist''s name?",
          "options": ["Diego", "Lucas", "Felipe"],
          "correct_index": 1
        },
        {
          "enunciado": "What kind of luggage does Emma have?",
          "options": ["A large suitcase", "A small bag", "No luggage"],
          "correct_index": 1
        },
        {
          "enunciado": "When will the guest have breakfast?",
          "options": ["Tonight", "Tomorrow morning", "Next week"],
          "correct_index": 1
        }
      ]
    }
  }'::jsonb
),
(
  'Craft Fair in Guaxupé',
  'Learn about selling recycled crafts and sustainable business practices.',
  'A1',
  '{
    "part1": {
      "image_url": "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&q=80&w=800",
      "options": [
        {"script": "Diego is showing handmade crafts to a customer at the local fair."},
        {"script": "A child is playing with plastic toys in a park."},
        {"script": "A chef is cooking pasta in a restaurant kitchen."}
      ],
      "correct_index": 0
    },
    "part2": [
      {
        "question_script": "What materials does Diego use for his crafts?",
        "options": [
          {"script": "Plastic and metal."},
          {"script": "Wood and paper."},
          {"script": "Glass and stone."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "What is Diego''s main goal?",
        "options": [
          {"script": "To travel the world."},
          {"script": "To grow his business and help the planet."},
          {"script": "To buy a new car."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "Who supports projects like Diego''s?",
        "options": [
          {"script": "Lucas."},
          {"script": "Jessica."},
          {"script": "Emma."}
        ],
        "correct_index": 1
      }
    ],
    "part3": {
      "dialogue": [
        {"speaker": "female", "text": "These bags are beautiful! What are they made of?"},
        {"speaker": "male", "text": "Thank you! We use recycled paper and wood. We never use plastic because we care about nature."}
      ],
      "questions": [
        {
          "enunciado": "What is the customer looking at?",
          "options": ["Ice cream", "Handmade bags", "Electronics"],
          "correct_index": 1
        },
        {
          "enunciado": "What material is NOT used in the crafts?",
          "options": ["Paper", "Plastic", "Wood"],
          "correct_index": 1
        },
        {
          "enunciado": "Why does Diego use recycled materials?",
          "options": ["It is cheaper", "He cares about nature", "It is easier"],
          "correct_index": 1
        }
      ]
    },
    "part4": {
      "script": "Diego works at a local fair in Guaxupé where he sells unique crafts. His business focuses on sustainability by using recycled materials like wood and paper. He dreams of exporting his culture while helping the environment. Customers like Jessica visit his stand to buy eco-friendly gifts and support the local community.",
      "questions": [
        {
          "enunciado": "Where does Diego work?",
          "options": ["In a supermarket", "At a local fair", "In an office"],
          "correct_index": 1
        },
        {
          "enunciado": "What does Diego want to share with the world?",
          "options": ["His money", "His culture", "His tools"],
          "correct_index": 1
        },
        {
          "enunciado": "What do people buy at Diego''s stand?",
          "options": ["Plastic bags", "Eco bags and gifts", "Recycled plastic"],
          "correct_index": 1
        }
      ]
    }
  }'::jsonb
),
(
  'Cultural Experience in Belém',
  'Explore the flavors and history of the Amazon at the Ver-O-Peso market.',
  'A2',
  '{
    "part1": {
      "image_url": "https://images.unsplash.com/photo-1543083477-4f7f44aad226?auto=format&fit=crop&q=80&w=800",
      "options": [
        {"script": "Renata is explaining the history of cassava flour to a group of tourists."},
        {"script": "A waiter is serving coffee at a fancy hotel."},
        {"script": "Children are playing soccer on the beach."}
      ],
      "correct_index": 0
    },
    "part2": [
      {
        "question_script": "How often does Renata take tourists to the market?",
        "options": [
          {"script": "Every month."},
          {"script": "Every week."},
          {"script": "Every day."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "What is the most refreshing drink mentioned?",
        "options": [
          {"script": "Coffee."},
          {"script": "Cupuaçu juice."},
          {"script": "Soda."}
        ],
        "correct_index": 1
      },
      {
        "question_script": "Which fish is considered more elaborate?",
        "options": [
          {"script": "Sardine."},
          {"script": "Filhote fish."},
          {"script": "Salmon."}
        ],
        "correct_index": 1
      }
    ],
    "part3": {
      "dialogue": [
        {"speaker": "female", "text": "This market is as old as the city itself."},
        {"speaker": "male", "text": "The smell of the fruit is amazing! Is this juice fresh?"},
        {"speaker": "female", "text": "Yes, the cupuaçu juice is the most refreshing thing you will try today."}
      ],
      "questions": [
        {
          "enunciado": "Where are Renata and the tourist?",
          "options": ["A shopping mall", "A traditional market", "A beach"],
          "correct_index": 1
        },
        {
          "enunciado": "What does the tourist think about the fruit?",
          "options": ["It is expensive", "The smell is amazing", "It looks old"],
          "correct_index": 1
        },
        {
          "enunciado": "What is Renata comparing the market to?",
          "options": ["A museum", "The age of the city", "A modern store"],
          "correct_index": 1
        }
      ]
    },
    "part4": {
      "script": "Renata provides educational tours at the Ver-o-Peso market in Belém. She believes her tours are as informative as history classes. She introduces visitors to Amazonian flavors, such as Cupuaçu juice and cassava flour, which she describes as being as essential as rice in the local diet. Her goal is to offer the most fascinating cultural and culinary experience in the region.",
      "questions": [
        {
          "enunciado": "What is Renata''s profession in this context?",
          "options": ["Chef", "Tour guide", "Market seller"],
          "correct_index": 1
        },
        {
          "enunciado": "How important is cassava flour in Brazilian food according to Renata?",
          "options": ["Less important than bread", "As important as rice", "Not important at all"],
          "correct_index": 1
        },
        {
          "enunciado": "What do the guests say about the experience?",
          "options": ["It is boring", "It is more fascinating than any place visited", "It is too long"],
          "correct_index": 1
        }
      ]
    }
  }'::jsonb
);
