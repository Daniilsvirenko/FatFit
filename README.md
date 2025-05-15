# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# FatFit Backend API

## Endpoints

### User Authentication & Quiz

- `POST /login`  
  Body: `{ username, password }`  
  Returns: Login result

- `POST /check-user`  
  Body: `{ username?, email? }`  
  Returns: `{ exists: true/false }`

- `POST /register`  
  Body: `{ fullname, username, email, password }`  
  Registers a new user

- `POST /answers`  
  Body: `{ username, answers }`  
  Saves quiz answers

- `GET /quiz`  
  Returns quiz questions

- `GET /`  
  Health check

### FatSecret Food Search

- `GET /fatsecret-search?q=apple`  
  Query: `q` (search term)  
  Returns: FatSecret food search results

## Setup

1. Add your MongoDB and FatSecret credentials to `.env`:
   ```
   MONGO_URI=...
   FATSECRET_CLIENT_ID=...
   FATSECRET_CLIENT_SECRET=...
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the backend:
   ```
   node server.js
   ```

4. Test endpoints using Postman or your frontend.
