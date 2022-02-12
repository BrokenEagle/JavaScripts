# ## PYTHON IMPORTS

import os
import json

# ## GLOBAL  VARIABLES

CSS_DIRECTORY = os.path.join(os.path.dirname(__file__), 'css')
JSON_DIRECTORY = os.path.join(os.path.dirname(__file__), 'json')
CSS_SETTINGS_FILEPATH = os.path.join(CSS_DIRECTORY, 'settings.css')
CSS_COLOR_FILEPATH = os.path.join(CSS_DIRECTORY, 'color.css')
JSON_OUTPUT_FILEPATH = os.path.join(JSON_DIRECTORY, 'debug_css.json')


# ## FUNCTIONS

def load_file(filepath):
    with open(filepath, 'r') as file:
        try:
            return file.read()
        except Exception:
            print("File not found!")
            return


def save_file(filepath, json_output):
    directory = os.path.dirname(filepath)
    if not os.path.exists(directory):
        os.makedirs(directory)
    with open(filepath, 'w') as file:
        file.write(json.dumps(json_output))


def main():
    json_output = {}
    if os.path.exists(CSS_SETTINGS_FILEPATH):
        print("Found settings file.")
        css_settings = load_file(CSS_SETTINGS_FILEPATH)
        if css_settings is not None:
            json_output['debug_settings_css'] = css_settings
    if os.path.exists(CSS_COLOR_FILEPATH):
        print("Found color file.")
        css_color = load_file(CSS_COLOR_FILEPATH)
        if css_settings is not None:
            json_output['debug_color_css'] = css_color
    print("Outputting JSON file.")
    save_file(JSON_OUTPUT_FILEPATH, json_output)


# ## EXECUTION START

if __name__ == '__main__':
    main()
