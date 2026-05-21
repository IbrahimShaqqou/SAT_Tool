#!/bin/bash
# Audit script for Skill 37 - Equivalent expressions

QUESTION_IDS=(
"2ac51123-99a1-43e3-b340-791be4958c92"
"617db71e-2c2e-4cd3-9c19-da8f54a7dbeb"
"688df85a-c23e-4486-9259-da152ee94c1f"
"b3d1b0f5-b47b-44e7-a37b-8401f0990954"
"ca3d21c1-0c81-4d1b-a931-7f700f4b7c9a"
"d47e05a8-5133-4b5b-819f-bd0f0019f1d2"
"d525e983-da46-4aa4-8f17-5cf424439f6c"
"01b9cdb9-27d3-448a-91ba-a921a50042bb"
"0bbf3924-d636-4b58-bb7f-0688d6993543"
"14ec0eee-3340-4689-9a10-0a1ddcf28842"
)

for id in "${QUESTION_IDS[@]}"; do
    echo "Checking question: $id"
    curl -s "http://localhost:8000/api/v1/questions/$id" | python3 -m json.tool
    echo "---"
done
