"""
demo.py — CLI script to run a full adversarial AI ethics debate.

Usage:
    # In one terminal: uvicorn main:app --reload --port 8000
    # In another terminal: python demo.py
"""

import json
import sys
import threading
import requests

BASE = "http://localhost:8000"

PRO_NAME = "Don"
CON_NAME = "Hil"


def print_separator(char="─", width=70):
    print(char * width)


def get_user_input(prompt: str, default: str = "") -> str:
    try:
        value = input(prompt).strip()
        return value if value else default
    except EOFError:
        return default


PRESET_TOPICS = [
    "AI surveillance and facial recognition in public spaces",
    "Autonomous weapons and lethal AI decision-making",
    "AI bias and algorithmic discrimination in hiring",
    "Generative AI and intellectual property rights",
    "AI replacing human workers and economic displacement",
    "AI in criminal sentencing and predictive policing",
    "Mandatory AI transparency and explainability laws",
    "AI consciousness and moral status of AI systems",
    "Data privacy and consent in AI training datasets",
    "AI-generated misinformation and deepfakes",
]


def step1_get_topic() -> str:
    print_separator("═")
    print("  ADVERSARIAL AI ETHICS DEBATE")
    print_separator("═")
    print()
    print("Select a topic:")
    print()
    for i, t in enumerate(PRESET_TOPICS, 1):
        print(f"  [{i:2}] {t}")
    print()
    print(f"  [ O] Other — enter your own topic")
    print()

    while True:
        choice = get_user_input("Your choice (number or O): ").strip().lower()
        if choice == "o":
            topic = ""
            while not topic:
                topic = get_user_input("Enter your topic: ").strip()
                if not topic:
                    print("Topic cannot be empty. Please try again.")
            return topic
        try:
            idx = int(choice)
            if 1 <= idx <= len(PRESET_TOPICS):
                return PRESET_TOPICS[idx - 1]
            else:
                print(f"  Please enter a number between 1 and {len(PRESET_TOPICS)}, or O.")
        except ValueError:
            print(f"  Invalid choice. Enter a number between 1 and {len(PRESET_TOPICS)}, or O.")


def step2_generate_personas(topic: str) -> dict:
    print()
    print(f"Generating debate personas for: \"{topic}\"")
    print("Calling Gemini...", end=" ", flush=True)

    resp = requests.post(f"{BASE}/debate/generate-setup", json={"topic": topic})
    if resp.status_code != 200:
        print(f"\nError: {resp.status_code} — {resp.text}")
        sys.exit(1)

    data = resp.json()
    data["agents"][0]["name"] = PRO_NAME
    data["agents"][1]["name"] = CON_NAME
    print("done.\n")
    return data


def step3_display_and_confirm(setup: dict) -> dict:
    topic = setup["topic"]
    agents = setup["agents"]

    while True:
        print_separator()
        print(f"  TOPIC: {topic}")
        print_separator()
        print()
        for agent in agents:
            side_label = "PRO" if agent["side"] == "pro" else "CON"
            print(f"  [{side_label}] {agent['name']}")
            print(f"  Stance: {agent['stance']}")
            print("  Key arguments:")
            for arg in agent["key_arguments"]:
                print(f"    • {arg}")
            print()

        print("Options:")
        print("  [Enter]  Accept and start the debate")
        print("  [r]      Re-generate personas")
        print("  [t]      Change topic")
        print()
        choice = get_user_input("Your choice: ").lower()

        if choice == "":
            return {"topic": topic, "agents": agents}
        elif choice == "r":
            print("\nRe-generating personas...")
            new_setup = step2_generate_personas(topic)
            topic = new_setup["topic"]
            agents = new_setup["agents"]
        elif choice == "t":
            topic = step1_get_topic()
            new_setup = step2_generate_personas(topic)
            topic = new_setup["topic"]
            agents = new_setup["agents"]
        else:
            print("  Invalid choice, press Enter to continue or type r/t.")


def step4_start_session(confirmed: dict) -> str:
    turns_input = get_user_input("\nHow many total debate turns? [default: 6]: ", "6")
    try:
        total_turns = int(turns_input)
    except ValueError:
        total_turns = 6

    payload = {
        "topic": confirmed["topic"],
        "agents": confirmed["agents"],
        "total_turns": total_turns,
    }
    resp = requests.post(f"{BASE}/debate/start", json=payload)
    if resp.status_code != 200:
        print(f"Error starting debate: {resp.status_code} — {resp.text}")
        sys.exit(1)

    session_id = resp.json()["session_id"]
    print(f"\nSession started: {session_id}")
    return session_id


def interrupt_listener(session_id: str, stop_event: threading.Event):
    """Background thread: reads user input and sends interrupts."""
    while not stop_event.is_set():
        try:
            comment = input()
        except EOFError:
            break
        if stop_event.is_set():
            break
        if comment.strip():
            resp = requests.post(
                f"{BASE}/debate/{session_id}/interrupt",
                json={"comment": comment.strip()},
            )
            if resp.status_code == 200:
                status = resp.json().get("status")
                if status == "queued":
                    print(f"\n  [Interrupt queued — agents will acknowledge it at the next turn]\n")
                else:
                    print(f"\n  [Debate not active: {status}]\n")


def step5_stream_debate(session_id: str, agents: list):
    agent_labels = {a["name"]: ("PRO" if a["side"] == "pro" else "CON") for a in agents}

    print()
    print_separator("═")
    print("  DEBATE STARTING — type a comment/question at any time to interrupt")
    print_separator("═")
    print()

    stop_event = threading.Event()
    listener = threading.Thread(
        target=interrupt_listener, args=(session_id, stop_event), daemon=True
    )
    listener.start()

    current_agent = None

    def restart_listener():
        nonlocal listener, stop_event
        stop_event = threading.Event()
        listener = threading.Thread(
            target=interrupt_listener, args=(session_id, stop_event), daemon=True
        )
        listener.start()

    try:
        with requests.get(f"{BASE}/debate/{session_id}/stream", stream=True) as resp:
            if resp.status_code != 200:
                print(f"Stream error: {resp.status_code} — {resp.text}")
                return

            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                if not line.startswith("data: "):
                    continue

                event = json.loads(line[6:])
                etype = event.get("event")
                payload = event.get("payload", {})

                if etype == "turn_start":
                    current_agent = payload["agent_name"]
                    side = agent_labels.get(current_agent, payload.get("side", "").upper())
                    turn_num = payload["turn_number"] + 1
                    print()
                    print_separator()
                    print(f"  Turn {turn_num} — [{side}] {current_agent}")
                    print_separator()
                    print()

                elif etype == "chunk":
                    print(payload["text"], end="", flush=True)

                elif etype == "turn_end":
                    print()

                elif etype == "round_end":
                    round_num = payload.get("round", "?")
                    stop_event.set()  # pause interrupt listener
                    print()
                    print_separator("═")
                    print(f"  END OF ROUND {round_num} — paused")
                    print_separator("═")
                    comment = get_user_input(
                        "  Press Enter to continue, or type a comment to add: "
                    )
                    if comment:
                        r = requests.post(
                            f"{BASE}/debate/{session_id}/interrupt",
                            json={"comment": comment},
                        )
                        if r.status_code == 200:
                            print(f"  [Comment queued]\n")
                    requests.post(f"{BASE}/debate/{session_id}/continue")
                    restart_listener()

                elif etype == "interrupt_ack":
                    agent_name = payload["agent_name"]
                    side = agent_labels.get(agent_name, "")
                    ack_text = payload["ack_text"]
                    print()
                    print_separator("·")
                    print(f"  INTERRUPT ACK — [{side}] {agent_name}:")
                    print(f"  {ack_text}")
                    print_separator("·")
                    print()

                elif etype == "debate_end":
                    print()
                    print_separator("═")
                    print(f"  DEBATE COMPLETE — {payload['total_turns']} turns")
                    print_separator("═")

                elif etype == "error":
                    print(f"\n[ERROR] {payload.get('message')}")

    finally:
        stop_event.set()


def main():
    # Check server is up
    try:
        requests.get(BASE, timeout=3)
    except requests.ConnectionError:
        print(f"Cannot connect to server at {BASE}")
        print("Start it with: uvicorn main:app --reload --port 8000")
        sys.exit(1)

    topic = step1_get_topic()
    setup = step2_generate_personas(topic)
    confirmed = step3_display_and_confirm(setup)
    session_id = step4_start_session(confirmed)
    step5_stream_debate(session_id, confirmed["agents"])


if __name__ == "__main__":
    main()
