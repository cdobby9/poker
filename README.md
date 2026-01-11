# poker


## usage:

cd frontend
npm run dev

cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000



## Workflow:

Daily workflow (both of you)
Create a feature branch

git checkout -b feature/ws-protocol


Work, commit:

git add .
git commit -m "Add initial WS message types"
git push -u origin feature/ws-protocol


Open PR on GitHub → other person reviews → merge.

Keep your branch up to date

git checkout main
git pull
git checkout feature/ws-protocol
git merge main
