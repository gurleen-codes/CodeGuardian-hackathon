import sys
from config.settings import OPENAI_API_KEY, LOG_LEVEL, PROJECT_NAME
from agents.ai_agent import CodeGuardianAgent
from utils.helpers import load_json, setup_logger

def run(input_path: str):
    logger = setup_logger(PROJECT_NAME, LOG_LEVEL)
    try:
        data = load_json(input_path)
        question = data.get("question", "").strip()
        if not question:
            logger.error("No question provided in input file.")
            sys.exit(1)

        agent = CodeGuardianAgent(api_key=OPENAI_API_KEY)
        logger.info(f"Sending question to AI agent: {question}")
        answer = agent.ask(prompt=question)
        print("\n=== AI Response ===\n")
        print(answer)

    except Exception as exc:
        logger.exception("Execution failed:")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python main.py <path_to_input.json>")
        sys.exit(1)
    run(sys.argv[1])
