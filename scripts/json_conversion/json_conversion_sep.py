import csv
import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("out_filename", help="Name of output JSON file",
                    type=str)
parser.add_argument("--chardata_filename", "-cd", help="Character data CSV file to convert to JSON",
                    type=str, required=False)
parser.add_argument("--playdata_filename", "-pd", help="Play data CSV file to convert to JSON",
                    type=str, required=False)

args = parser.parse_args()

if not any([args.chardata_filename, args.playdata_filename]):
    raise ValueError("Please provide character data or play data CSV file")

def load_csv(filename: str) -> list:
    """Load a CSV file into a list of dictionaries.

    Args:
        filename (str): Name of CSV file to load.

    Returns:
        list: List of dictionaries,
        each dictionary being a row of the CSV file
        with column name as key and cell value as value.
    """
    with open(filename, "r", encoding="utf8") as f:
        return list(csv.DictReader(f))

def convert_to_json(data: dict, type: str) -> dict:
    """Convert data to a specific JSON template depending on type.

    Args:
        data (dict): Data to convert to JSON template.
        type (str): Type of data to convert to JSON template
        ("char_data" or "play_data")
    Returns:
        dict: JSON template with data of type specified.
    """
    json_template_char = {"data": {"characters": []}}
    json_template_play = {"data": {"plays": []}}

    if type == "char_data":
        char_data = [{k: None if not v else v for k, v in dct.items()}
            for dct in data]

        # convert zeroes as values of "cl", "isGrp" to False, and ones to True
        char_data = [{k: False if k in ["cl", "isGrp"] and v == "0.0"
                else v for k, v in dct.items()}
                for dct in char_data]
        char_data = [{k: True if k in ["cl", "isGrp"] and v == "1.0"
                else v for k, v in dct.items()}
                for dct in char_data]

        # convert ids to integers
        char_data = [{k: int(float(v)) if k in ["workId", "characterId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in char_data]

        for char_dict in char_data:
            json_template_char["data"]["characters"].append(char_dict)

        return json_template_char

    if type == "play_data":
        play_data = [{k: None if not v else v for k, v in dct.items()}
            for dct in data]

        # split values with comma into list
        play_data = [{k: v.replace(" ", "").split(",")
                if k in ["authorId", "nbScenes"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in play_data]

        # replace question marks with "unknown"
        play_data = [{k: "unknown" if v == "?" else v for k, v in dct.items()}
                for dct in play_data]

        for play_dict in play_data:
            json_template_play["data"]["plays"].append(play_dict)

        return json_template_play

def write_json(filename: str, json_template: dict) -> None:
    """Write a JSON template to a JSON file.

    Args:
        filename (str): Name of JSON file to write.
        json_template (dict): JSON template to write to file.
    """
    with open(f"{filename}", "w", encoding="utf8") as f:
        json.dump(json_template, f, indent=4)
        print(f"JSON file successfully written to {f.name}")

if __name__ == "__main__":
    if args.chardata_filename:
        char_data = load_csv(args.chardata_filename)
        json_template = convert_to_json(char_data, "char_data")
    elif args.playdata_filename:
        play_data = load_csv(args.playdata_filename)
        json_template = convert_to_json(play_data, "play_data")
    write_json(args.out_filename, json_template)