import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3-dsv';
import { VegaLite } from 'react-vega';

const url = process.env.NODE_ENV === 'production' 
  ? 'https://hai-course.onrender.com' 
  : 'http://127.0.0.1:8000/';

function App() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // For showing the thinking message
  const [showPreview, setShowPreview] = useState(true);
  const chatEndRef = useRef(null);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const newChatHistory = [...chatHistory, { sender: 'user', message }];
    setChatHistory(newChatHistory);
    setMessage(""); // Clear the message input after sending

    if (!data) {
      setChatHistory([...newChatHistory, { sender: 'bot', message: "Please upload a dataset first." }]);
      return;
    }

    setIsThinking(true); // Start thinking indicator

    try {
      const apiUrl = new URL('/query/', url).toString();  // Correctly handle the URL construction
      console.log("API URL:", apiUrl);
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ prompt: message, data }),
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!res.ok) {
        console.error("API responded with error status:", res.status);
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      console.log("API Response:", result);

      const { chartSpec, description } = result; // Get the description

      setIsThinking(false); // Stop thinking indicator
      setChatHistory([...newChatHistory, { sender: 'bot', message: description, chartSpec }]);
    } catch (error) {
      console.error("Error fetching the response:", error);
      setIsThinking(false); // Stop thinking indicator
      setChatHistory([...newChatHistory, { sender: 'bot', message: "An error occurred. Please try again." }]);
    }
  };

  const handleFileUpload = (file) => {
    if (file && file.type === 'text/csv') {
      setFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvData = d3.csvParse(event.target.result, d3.autoType);
        setData(csvData);
        setChatHistory([...chatHistory, { sender: 'bot', message: 'Dataset uploaded successfully.' }]);
      };
      reader.readAsText(file);
    } else {
      setChatHistory([...chatHistory, { sender: 'bot', message: 'Please upload a valid CSV file.' }]);
    }
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    handleFileUpload(uploadedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const uploadedFile = e.dataTransfer.files[0];
    handleFileUpload(uploadedFile);
  };

  const handleMessage = (e) => {
    setMessage(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Error boundary for VegaLite
  const VegaLiteWithErrorHandling = ({ spec }) => {
    try {
      return <VegaLite spec={spec} width={500} height={300} />; // Make the chart bigger
    } catch (error) {
      console.error("Error rendering VegaLite chart:", error);
      return <p className="text-red-500">Unable to render chart. The chart specification is invalid.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg p-6 space-y-6">
        <h1 className="text-3xl text-center font-bold text-gray-900">Data Visualization</h1>
        <p className="text-center text-gray-500">Upload a dataset and prompt a data visualization based on that dataset</p>

        {/* File upload box */}
        <div 
          className={`border-4 ${isDragging ? 'border-blue-600' : 'border-gray-300'} border-dashed rounded-lg p-6 text-center cursor-pointer`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <p className="text-gray-500">Drag & Drop a CSV file here, or click to upload</p>
          <input
            type="file"
            id="fileInput"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Dataset preview */}
        {data && (
          <div className="mt-4">
            <button 
              onClick={togglePreview}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mb-2"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            {showPreview && (
              <div className="overflow-auto border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-inner max-h-40">
                <table className="table-auto w-full text-left text-sm">
                  <thead>
                    <tr>
                      {Object.keys(data[0]).map((col) => (
                        <th key={col} className="px-4 py-2 border-b border-gray-200">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 10).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.values(row).map((value, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 border-b border-gray-200">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Chat area */}
        <div className="overflow-y-auto h-80 mb-5 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-inner">
          {chatHistory.length === 0 ? (
            <p className="text-gray-500 text-center">No messages yet. Start the conversation!</p>
          ) : (
            chatHistory.map((chat, index) => (
              <div key={index} className={`mb-4`}>
                <div className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {chat.sender === 'bot'}
                  {chat.sender === 'user'}
                  <div className={`flex flex-col ${chat.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Render chart above the message if present */}
                    {chat.chartSpec && Object.keys(chat.chartSpec).length > 0 && (
                      <div className="mb-2">
                        <VegaLiteWithErrorHandling spec={chat.chartSpec} />
                      </div>
                    )}
                    <div className={`flex items-center ${chat.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'} rounded-lg p-3 max-w-md shadow w-auto`}>
                      <div className="text-base break-words">
                        {chat.message}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Show "thinking..." message while waiting for API */}
          {isThinking && (
            <div className="text-gray-500 text-center mb-4">Thinking...</div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Message input */}
        <div className="flex">
          <input 
            type="text" 
            placeholder="Type your message..." 
            value={message} 
            onChange={handleMessage} 
            onKeyPress={handleKeyPress} 
            className="flex-grow p-4 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
          />
          <button 
            className="bg-indigo-600 text-white px-6 py-4 rounded-r-lg hover:bg-indigo-700 transition duration-200" 
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
  }
  
  export default App;
  