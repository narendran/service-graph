#!/usr/bin/python

import random
import urllib
import time

while True:
  urllib.urlopen('http://localhost:3500/PreferencesService')
  urllib.urlopen('http://localhost:4321/WebStoreService')
  urllib.urlopen('http://localhost:5000/EmailService')
