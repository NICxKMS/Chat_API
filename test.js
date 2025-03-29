const axios = require('axios');

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:3000/api/chat/completions', {
      model: 'gemini/gemini-1.5-flash',
      messages: [
        { role: 'user', content: 'Say hello' }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('API Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAPI(); 