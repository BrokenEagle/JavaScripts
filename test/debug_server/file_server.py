# ## PYTHON IMPORTS
import os
from flask import Flask, send_from_directory

# ## GLOBAL VARIABLES

SERVER_APP = Flask(__name__)
SERVER_JSON_DIRECTORY = os.path.join(os.path.dirname(__file__), 'json')


# ## FUNCTIONS

@SERVER_APP.route('/<path:path>', methods=['GET', 'POST'])
def send_json_files(path):
    response = send_from_directory(SERVER_JSON_DIRECTORY, path)
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


# ## EXECUTION START

if __name__ == '__main__':
    SERVER_APP.run(port=5555)
