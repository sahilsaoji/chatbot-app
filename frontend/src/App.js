// src/App.js
import React, { useState } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);

  const sendMessage = async () => {
    if (message.trim() === '') return; // Prevent sending empty messages

    // Add the user's message to the chat
    setChat((prev) => [...prev, { sender: 'user', text: message }]);
    setMessage(''); // Clear the input field

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();

      // Add the bot's response to the chat
      setChat((prev) => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (error) {
      // Handle fetch error
      setChat((prev) => [...prev, { sender: 'bot', text: 'not working dawg' }]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Chat with GPT</h1>
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-4 flex flex-col gap-2">
        <div className="flex flex-col space-y-2 overflow-y-auto max-h-80 p-2">
          {chat.map((msg, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white self-end'
                  : 'bg-gray-300 text-black self-start'
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className="flex mt-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
