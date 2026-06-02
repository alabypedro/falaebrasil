INSERT INTO public.listening_lessons (id, title, level, description, content) 
VALUES (
  gen_random_uuid(),
  'Unit 05 - Global Coffee Export & Logistics',
  'B1',
  'Explore the complexities of international trade and the logistical journey of coffee from the farm to the world.',
  '{
    "image_url": "/src/assets/listening-b1-unit05.png",
    "parts": [
      {
        "part_number": 1,
        "type": "image",
        "image_url": "/src/assets/listening-b1-unit05.png",
        "description": "Look at the image of the shipping container and dock workers. Choose the most accurate description.",
        "options": [
          "The ship is sinking due to bad weather conditions.",
          "Logistics coordinators are overseeing the loading of coffee export containers at a busy port terminal.",
          "A small group of farmers is manually carrying coffee bags across a field."
        ],
        "correct_index": 1
      },
      {
        "part_number": 2,
        "type": "questions",
        "description": "Test your knowledge about international trade terms (Incoterms) and export processes.",
        "questions": [
          {
            "question": "What does ''FOB'' (Free On Board) typically mean in a shipping contract?",
            "options": [
              "The buyer pays for everything from the farm.",
              "The seller is responsible until the goods are loaded onto the vessel.",
              "The shipping is completely free for everyone."
            ],
            "correct_index": 1
          },
          {
            "question": "Which document serves as a contract of carriage and a receipt for the cargo?",
            "options": [
              "Bill of Lading",
              "Commercial Invoice",
              "Packing List"
            ],
            "correct_index": 0
          },
          {
            "question": "Why is moisture control essential during maritime transport of coffee?",
            "options": [
              "To make the coffee heavier and more expensive.",
              "To prevent mold and preserve the quality of the green beans.",
              "To ensure the beans stay green forever."
            ],
            "correct_index": 1
          }
        ]
      },
      {
        "part_number": 3,
        "type": "dialogue",
        "description": "Listen to the dialogue between an export manager and a logistics agent.",
        "dialogue": [
          {"speaker": "female", "text": "Hi, Marcus. I need an update on the 20-ton shipment for Hamburg. Has the vessel departed yet?"},
          {"speaker": "male", "text": "Hi, Elena. Not yet. There is a slight delay at the port due to a customs inspection, but the Bill of Lading is already issued."},
          {"speaker": "female", "text": "That is concerning. Our client in Germany needs those beans by the 15th for their seasonal blend."},
          {"speaker": "male", "text": "I understand. I am pushing the terminal to prioritize our container. We should be on the next ship out tomorrow morning."},
          {"speaker": "female", "text": "Okay. Please ensure the phytosanitary certificates are all in order to avoid further delays in Europe."},
          {"speaker": "male", "text": "Don''''t worry, Elena. Everything is double-checked. I''''ll send you the tracking number as soon as the ship sails."}
        ],
        "questions": [
          {
            "enunciado": "Where is the coffee shipment going?",
            "options": ["To New York.", "To Hamburg.", "To Tokyo."],
            "correct_index": 1
          },
          {
            "enunciado": "What is causing the delay at the port?",
            "options": ["A storm.", "A customs inspection.", "A worker strike."],
            "correct_index": 1
          },
          {
            "enunciado": "What will Marcus send to Elena once the ship sails?",
            "options": ["A bag of coffee.", "The tracking number.", "A new contract."],
            "correct_index": 1
          }
        ]
      },
      {
        "part_number": 4,
        "type": "narrative",
        "description": "Listen to the report on the optimization of the global coffee supply chain.",
        "text": "The global coffee supply chain is a marvel of modern logistics. From the high-altitude plantations of Brazil to the roasting houses in Europe and North America, every step must be synchronized. Recently, the industry has seen a shift towards ''Direct Trade'' models, which shorten the supply chain by connecting roasters directly with producers. This not only ensures better prices for farmers but also improves traceability. However, challenges such as container shortages and fluctuating fuel prices continue to test the resilience of global exports.",
        "questions": [
          {
            "enunciado": "What is a benefit of the ''Direct Trade'' model mentioned?",
            "options": ["It makes the coffee taste better.", "It ensures better prices for farmers and improves traceability.", "It makes the shipping slower."],
            "correct_index": 1
          },
          {
            "enunciado": "Who does the Direct Trade model connect roasters with?",
            "options": ["Supermarkets.", "Directly with producers.", "Government officials."],
            "correct_index": 1
          },
          {
            "enunciado": "What is mentioned as a current challenge for global exports?",
            "options": ["Lack of demand.", "Container shortages and fuel price fluctuations.", "Too many ships in the ocean."],
            "correct_index": 1
          }
        ]
      }
    ]
  }'
);