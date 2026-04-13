const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');
const bodyParser = require('body-parser');


dotenv.config();

//Importing routes
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');

const app = express();
const PORT = process.env.PORT;

app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});