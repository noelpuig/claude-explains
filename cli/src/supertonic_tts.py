#!/usr/bin/env python3
import sys
import json

def main():
    if len(sys.argv) < 2:
        print("Usage: supertonic_tts.py <input.json>", file=sys.stderr)
        sys.exit(1)

    try:
        from supertonic import TTS
    except ImportError:
        print("Error: supertonic not installed. Run: pip install supertonic", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1]) as f:
        data = json.load(f)

    voice = data.get("voice", "M1")
    model = data.get("model", "supertonic-3")
    total_steps = data.get("total_steps", 8)
    speed = data.get("speed", 1.05)
    clips = data["clips"]

    print(f"  Model: {model}, steps: {total_steps}, speed: {speed}", file=sys.stderr)
    tts = TTS(model=model, auto_download=True)
    style = tts.get_voice_style(voice_name=voice)

    results = []
    for i, clip in enumerate(clips):
        text = clip["text"]
        output = clip["output"]
        print(f"  Clip {i+1}/{len(clips)}: \"{text[:50]}\"", file=sys.stderr)
        try:
            wav, dur = tts.synthesize(text, voice_style=style, total_steps=total_steps, speed=speed)
            tts.save_audio(wav, output)
            duration = float(dur[0])
            print(f"    Duration: {duration:.2f}s", file=sys.stderr)
            results.append({"output": output, "duration": duration})
        except Exception as e:
            print(f"    Error: {e}", file=sys.stderr)
            results.append({"output": output, "duration": 0})

    print(json.dumps(results))

if __name__ == "__main__":
    main()
