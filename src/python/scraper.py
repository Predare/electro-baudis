import atexit
import sys
import json
import BookWebAPI


def kill_subprocess():
    print('killed')


def search(request):
    return BookWebAPI.search(request['searchStr'], request['pageNum'])


def download(request):
    BookWebAPI.download(request['link'])


def makeTest():
    test_message = {
        'typeMessage': 'search',
        'searchStr': 'Айзек',
        'pageNum': '2'
    }
    result = handle_message(json.dumps(test_message))
    print(result)


def handle_message(request):
    parsed_message = json.loads(request)
    switcher = {
        'search': search,
        'download': download
    }
    type_m = parsed_message['typeMessage']

    response = switcher[type_m](parsed_message)
    result = None
    if type_m == 'search':
        result = {
            'typeMessage': 'search',
            'books': response['books'],
            'pageCount': response['pageCount'],
            'currentPage': parsed_message['pageNum']
        }
    return result


while True:
    message = sys.stdin.readline()
    if message != '':
        answer = handle_message(message)
        if answer is not None:
            print(json.dumps(answer), flush=True)
