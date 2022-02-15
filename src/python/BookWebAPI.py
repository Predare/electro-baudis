import json
import os
import urllib3
from requests import get
from bs4 import BeautifulSoup
from threading import Thread
from requests_html import HTMLSession
import uuid
from threading import Lock
from pathlib import Path

printLock = Lock()


def search(search_str, page_num):
    response = search_request(search_str.encode('cp1251').decode('utf-8'), page_num)
    books = parse_list_page(response.text)
    return books


def search_request(search_str, page_num):
    response = get('https://akniga.org/search/books/page{currentPage}/?q={search_str}'.
                   format(currentPage=page_num, search_str=search_str))
    return response


def parse_list_page(html):
    soup = BeautifulSoup(html, 'lxml')

    page_navs = soup.find('div', class_='page__nav')
    page_count = 1
    if page_navs is not None:
        page_navs_a = page_navs.find_all('a')
        if len(page_navs_a) > 2:
            page_count = page_navs_a[-2].text.strip()
    if soup.find('div', _class="ls-blankslate-text") is not None:
        return
    enters = soup.find_all('div', class_='content__main__articles--item')
    enters_array = []

    for enter in enters:
        paid_book = enter.find('a', {'href': 'https://akniga.org/paid/'})
        if paid_book is not None:
            continue  # Its paid book, don't show in list
        authors = enter.find('div', class_='additional-info').findAll('span',
                                                                      class_='link__action link__action--author')
        book = {'title': enter.find('h2', class_='caption__article-main').text.strip(),
                'descr': enter.find('span', class_='description__article-main').text.strip(),
                'poster': enter.find('div', class_='container__remaining-width article--cover pull-left').find('img')[
                    'src'], 'link': enter.find('a', class_='content__article-main-link tap-link')['href']
                }
        if len(authors) >= 2:
            book['author'] = authors[0].text.strip()
            book['voiceActor'] = authors[1].text.strip()
        else:
            book['author'] = ''
            book['voiceActor'] = authors[0].text.strip()

        enters_array.append(book)

    result = {
        'books': enters_array,
        'pageCount': page_count
    }
    return result


session = None


def download(page_link):
    global session
    try:
        with HTMLSession() as session:

            response = session.get(page_link)
            response.html.render()
            response.close()
            download_link = get_download_link(response)
            unique_filename = str(uuid.uuid4().hex)
            thread = Thread(target=loading, args=(page_link, download_link, unique_filename), daemon=True)
            thread.start()
    except Exception as e:
        raise e


def get_download_link(html):
    data_bid = html.html.find('div.bookpage--chapters.player--chapters', first=True).attrs['data-bid']
    jpl_players = html.html.find('div.jpl')
    download_link = None

    for jpl in jpl_players:
        if 'data-bid' in jpl.attrs and jpl.attrs['data-bid'] == data_bid:
            download_link = jpl.find('audio', first=True).attrs['src']

    if download_link is None:
        raise ValueError(f'Download link not found \n Response {html}')
    return download_link


poolM = urllib3.PoolManager()


def loading(page_link, link, filename, path=os.path.expanduser('~/electro-baudis-books/books/')):
    try:
        response = poolM.request('GET', link, preload_content=False, enforce_content_length=True)  # Get file link
        Path(path).mkdir(parents=True, exist_ok=True)  # Create directory for books if not exist
        content_length = response.getheader('Content-Length')
        chunk_size = 1024
        file_percent = int(content_length) / 100
        load_percent = 0;
        in_complete_percent = 0;

        # Create file and write in
        with open(R'{path}{filename}.mp3'.format(path=path, filename=filename), 'wb') as out_file:
            for chunk in response.stream(chunk_size):
                if chunk:
                    in_complete_percent += chunk_size
                    if in_complete_percent >= file_percent:
                        load_percent += 1
                        in_complete_percent -= file_percent
                        syncPrintJSON({'typeMessage': 'loading', 'link': page_link, 'percent': load_percent})
                    out_file.write(chunk)
        syncPrintJSON({'typeMessage': 'downloaded', 'link': page_link, 'filename': filename, 'path':
            f'{path}/{filename}.mp3'})
    except BaseException as e:
        raise e


def syncPrintJSON(message):
    printLock.acquire()
    print(json.dumps(message), flush=True)
    printLock.release()
