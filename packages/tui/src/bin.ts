#!/usr/bin/env node
import { createElement } from 'react';
import { render } from 'ink';
import { App } from './app.js';

// Imperative shell: mount the Ink application. Kept JSX-free so this entry is a
// plain `.ts` module.
render(createElement(App));
