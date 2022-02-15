

document.addEventListener("DOMContentLoaded", event => {
    ListAPI.build();
    ResponseHandler.build();
});

class ListAPI{  
    static searchInput;
    static listElement;
    static paginationStatus = {
        currentPage: 1,
        pageCount: 1
    }
    static paginationButtons;
    static lastSearchString;

    static build(){
        //window.baudisAPI.getloadedBooks();
        //ListAPI.loadItems(loadedbooks);       
        ListAPI.listElement = document.getElementById("book_list");
        ListAPI.searchInput = document.getElementById('searchInput')

        ListAPI.searchInput.addEventListener('keyup', async (e) => {
            if (e.key === "Enter") {
                ListAPI.lastSearchString = ListAPI.searchStr = searchInput.value;
                ListAPI.paginationStatus.currentPage = 1;
                ListAPI.loadPage();
            }
        });

        let pagList = document.querySelector("#paginationList");

        ListAPI.paginationButtons = {
            firstButton: pagList.querySelector("#firstButton"),
            prevButton: pagList.querySelector("#prevButton"),
            currButton: pagList.querySelector("#currButton"),
            nextButton: pagList.querySelector("#nextButton"),
            lastButton: pagList.querySelector("#lastButton")
        }
        let pagButtons = ListAPI.paginationButtons; 
        //Func add click listener and run changePage() with choosed operator
        let addClick = (button,operator) => {button.addEventListener('click', function() {ListAPI.changePage(operator)})};
        addClick(pagButtons.firstButton,'<<');
        addClick(pagButtons.prevButton,'<');
        addClick(pagButtons.nextButton,'>');
        addClick(pagButtons.lastButton,'>>');

        window.baudisAPI.getloadedBooks();
    }

    static changePage(direction){
        switch(direction){
            case '<<':
                if(this.paginationStatus.currentPage == 1) return;
                ListAPI.paginationStatus.currentPage = 1;           
                break;
            case '<':
                if(this.paginationStatus.currentPage == 1) return;
                ListAPI.paginationStatus.currentPage -= 1;
                break;
            case '>':
                if(this.paginationStatus.currentPage == this.paginationStatus.pageCount)return;
                ListAPI.paginationStatus.currentPage += 1;             
                break;
            case '>>':
                if(this.paginationStatus.currentPage == this.paginationStatus.pageCount)return;
                ListAPI.paginationStatus.currentPage = ListAPI.paginationStatus.pageCount;
                break;
            default:
                return;
        }
        ListAPI.loadPage();
    }

    static loadPage(){
        ListAPI.clear();
        window.baudisAPI.search(ListAPI.lastSearchString,ListAPI.paginationStatus.currentPage);
    }

    static clear(){
        ItemAPI.books.forEach(item => {
            ItemAPI.remove(item.elem);
        });
        ItemAPI.books = [];
    }

    static loadItems(response){
        if(response.length == 0) return;
        
        ListAPI.clear();
        if(response.books)ItemAPI.add(response.books);
        else ItemAPI.add(response);

        if(response.pageCount && response.currentPage){
            ListAPI.paginationStatus.currentPage = response.currentPage;
            if(ListAPI.paginationStatus.currentPage == 1)ListAPI.paginationStatus.pageCount = response.pageCount; 
        }

        ListAPI.showPagination();
    }

    //Shows pagination buttons
    static showPagination(){
        let {firstButton,prevButton,currButton,nextButton,lastButton} = ListAPI.paginationButtons;
        let {currentPage,pageCount} = ListAPI.paginationStatus;

        if(currentPage === 1)prevButton.setAttribute('class',prevButton.getAttribute('class') + ' disabled');
        else{
            let buttonClass = prevButton.getAttribute('class');
            buttonClass = buttonClass.replaceAll('disabled','');
            prevButton.setAttribute('class', buttonClass);
        }

        if(currentPage === 1){
            firstButton.setAttribute('class',firstButton.getAttribute('class') + ' disabled');
            firstButton.querySelector("a").innerHTML = '...';
        }else{
            let buttonClass = firstButton.getAttribute('class');
            buttonClass = buttonClass.replaceAll('disabled','');
            firstButton.setAttribute('class', buttonClass);
            firstButton.querySelector("a").innerHTML = 1;
        }

        currButton.innerHTML = currentPage;
        
        if(pageCount > currentPage){
            let buttonClass = nextButton.getAttribute('class');
            buttonClass = buttonClass.replaceAll('disabled','');
            nextButton.setAttribute('class', buttonClass);
        }else nextButton.setAttribute('class',nextButton.getAttribute('class') + ' disabled');

        if(pageCount > currentPage){
            lastButton.querySelector("a").innerHTML = pageCount;

            let buttonClass = lastButton.getAttribute('class');
            buttonClass = buttonClass.replaceAll('disabled','');
            lastButton.setAttribute('class', buttonClass);
        }else {
            lastButton.querySelector("a").innerHTML = '...';
            lastButton.setAttribute('class',lastButton.getAttribute('class') + ' disabled');
        }       
    }

    //Delete book from diskspace and books
    static async delete(book){
        window.baudisAPI.delete(book.link);
    }

    //Download book and refresh in list
    static download(book){
        let reducedBook = {}
        Object.assign(reducedBook,book);
        reducedBook.elem = null;
        window.baudisAPI.download(reducedBook);
    }

    static play(link){
        window.baudisAPI.play(link);
    }

}

class ItemAPI{
    static books = [];

    static setLoadStatus(link,status){
        let book = ItemAPI.books.find( book => book.link == link);
        book.loaded = status;
        ItemAPI.refreshItem(book);
    }

    static refreshItem(book){
        let bookInd = ItemAPI.books.findIndex(elem => {return elem == book});
        let oldElem = ItemAPI.books[bookInd].elem;
        ItemAPI.books.splice(bookInd,1);
        ItemAPI.add(book, -1, oldElem);
        ItemAPI.remove(oldElem);
        //bookInd = ItemAPI.books.findIndex(elem => {return elem == book}); 
    }

    static add(newBooks,index = 0, oldElem = null){
        if(Array.isArray(newBooks)){
            newBooks.forEach( item =>{
                ProxyAdder.add(item);
            });
        }else{
            ProxyAdder.add(newBooks,index,oldElem);
        }
    }

    //Remove book from books
    static remove(elem){
        ListAPI.listElement.removeChild(elem); // Remove elem from list
    }

    static refreshLoadStatus(link,percent){
        let book = ItemAPI.books.find( book => book.link == link);
        book.elem.querySelector(".loadBar").innerHTML = `${percent}%`;
    }
}

class ProxyAdder{
    static add(book,index = -1,insertBeforeElem = null){
        let cellTemplate;
        //Indicate if this book is already loaded
        let downloadedBook = false;
        if(book?.loaded) downloadedBook = true;
        //Choose right template for loaded or only searched book
        if(!downloadedBook)cellTemplate = document.querySelector("#book_searched_cell_template");
        else cellTemplate = document.querySelector("#book_downloaded_cell_template");
        
        //Clone template and filling it
        const clone = cellTemplate.content.firstElementChild.cloneNode(true);
        let title = clone.querySelector("#title");
        let descr = clone.querySelector('#description');
        let poster = clone.querySelector('#poster');
        let voiceActor = clone.querySelector('#voiceActor');
        let author = clone.querySelector('#author');   
        let collapser = clone.querySelector('.collapse');
        let collapserId = `Collapser-${ItemAPI.books.length}`
        collapser.setAttribute('id',collapserId);   
        title.setAttribute('href',`#${collapserId}`);
        title.innerHTML = book.title;
        descr.innerHTML = book.descr;
        poster.setAttribute('src',book.poster);
        voiceActor.innerHTML = book.voiceActor;
        author.innerHTML = book.author;

        //Add elem in list and html
        book.elem = clone;
        if(insertBeforeElem == null)ListAPI.listElement.appendChild(clone);
        else ListAPI.listElement.insertBefore(clone,insertBeforeElem)
        if(index == -1)ItemAPI.books.push(book);
        else ItemAPI.books.splice(index,0,book);
        

        if(!downloadedBook){
            let downloadButton = clone.querySelector("#downloadButton");
            
            //Add event listener on downloadButton
            downloadButton.addEventListener('click', e => {
                ListAPI.download(book);
            })
        }else {
            let playButton = clone.querySelector('#playButton');
            let deleteButton = clone.querySelector('#deleteButton');
            
            playButton.addEventListener('click', e => {
                ListAPI.play(book.link);
            })
            deleteButton.addEventListener('click', e => {
                ListAPI.delete(book);
            })
        }        
    }
}

class ResponseHandler{
    static build(){
        window.rendererAPI.search(ResponseHandler.search);
        window.rendererAPI.downloaded(ResponseHandler.downloaded);
        window.rendererAPI.delete(ResponseHandler.delete);
        window.rendererAPI.getloadedBooks(ResponseHandler.getloadedBooks);
        window.rendererAPI.loading(ResponseHandler.loading);
    }

    static search(e, response){
        ListAPI.loadItems(response);
    }

    static downloaded(e, link){
        ItemAPI.setLoadStatus(link,true);
    }

    static delete(e, link){
        ItemAPI.setLoadStatus(link,false);
    }

    static getloadedBooks(e, response){      
        ListAPI.loadItems(response);
    }

    static loading(e, response){      
        ItemAPI.refreshLoadStatus(response.link,response.percent);
    }
}