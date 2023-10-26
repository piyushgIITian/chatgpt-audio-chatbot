from flask import Flask, render_template
from elevenlabs import generate, set_api_key, Voice, VoiceSettings
import openai
import json
import base64
import os
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
# Load .env file
load_dotenv()

# use the variable names as defined in .env file
openai.api_key = os.environ.get("OPENAI_API_KEY")
eleven_labs_api_key = os.environ.get("ELEVENLABS_API_KEY")


set_api_key(eleven_labs_api_key)

# Initialize a list of messages with a system message

app = Flask(__name__, template_folder='templates')
socketio = SocketIO(app)

messages = [{"role": "system", "content": "You are an intelligent assistant."}]


@app.route("/")
def home():
    messages.clear()
    messages.append(
        {"role": "system", "content": "You are an intelligent assistant."})
    return render_template('main.html')


line_breakers = ['.', '\n', ',']


def gpt_chunk_generator(chat):
    assistant_reply = ""

    for chunk in chat:
        try:
            reply_chunk = chunk.choices[0].delta.get('content', '')
            # reply_chunk = reply_chunk.replace('\n', ' \n ')
            assistant_reply += reply_chunk

            # Check if the assistant_reply contains a full stop, space, or new line
            # if any(char in reply_chunk for char in line_breakers):
            emit('assistant_reply', json.dumps(
                {'reply': assistant_reply}))

            yield assistant_reply
            assistant_reply = ""
        except Exception as e:
            print(e)


@socketio.on('user_message')
def handle_user_message(message):

    # Process user input and send responses to the client
    user_message = message.get("content")
    if user_message:
        messages.append({"role": "user", "content": user_message})

    # Create a chat completion
    chat = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        stream=True
    )
    audio_stream = generate(
        text=gpt_chunk_generator(chat),
        voice=Voice(
            voice_id='XB0fDUnXU5powFXDhCwa',
            settings=VoiceSettings(
                stability=0.71, similarity_boost=0.8, style=0.0, use_speaker_boost=True)

        ),
        model="eleven_monolingual_v1",
        stream=True
    )
    for a_chunk in audio_stream:

        base64EncodedStr = base64.b64encode(a_chunk)
        output = base64EncodedStr.decode('utf-8')
        emit('assistant_reply', json.dumps({'audio': output}))
    # messages.clear()
    emit('assistant_reply', json.dumps(
        {'completed': True, 'audio': None, 'reply': None}))


if __name__ == '__main__':
    socketio.run(app, debug=True)
