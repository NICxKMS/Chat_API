/**
 * Main server entry point
 * Sets up Express server with configured routes and middleware
 */
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const config = require('./config/config'); 