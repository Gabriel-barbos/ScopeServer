import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

async function getToken({ login, password }) {
  const params = new URLSearchParams();

  params.append('client_id', process.env.CLIENT_ID || 'mz-eqmaranhao');
  params.append('client_secret', process.env.CLIENT_SECRET || 'G8PcqkHikp%BUejsv.C!^wzr');
  params.append('username', login);
  params.append('Password', password);
  params.append('grant_type', 'password');
  params.append('response_type', 'code id token');

  const response = await fetch('https://login.mzoneweb.net/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao gerar token para ${login}: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

export default getToken;