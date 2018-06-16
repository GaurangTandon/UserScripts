// ==UserScript==
// @name         Review queue shortcuts for Stack Exchange
// @description  better version of CloseVoteShortcuts that also works on all SE sites as well as in all other queus (edit/reopen/etc.)
// @version      0.1
// @author       Gaurang Tandon
// @match        *://stackoverflow.com/review/*
// @match        *://*.stackexchange.com/review/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function $(selector){
        var elms = document.querySelectorAll(selector), elm, len = elms.length;

		// cannot always return a NodeList/Array
		// as properties like firstChild, lastChild will only be able
		// to be accessed by elms[0].lastChild which is too cumbersome
        if(len === 0) return null;
		else if (len === 1) {
			elm = elms[0];
			// so that I can access the length of the returned
			// value else length if undefined
			elm.length = 1;
			return elm;
		}
		else return elms;
    }

    function hasClass(node, className){
        return node.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(node.className);
    }

    function forEach(nodeList, fn){
        var i = 0, len = nodeList.length;

        for(; i < len; i++){
            fn.call(this, nodeList[i]);
        }
    }

    function invokeClick(element){
        var clickEvent = new MouseEvent("click", {
            "view": window,
            "bubbles": true,
            "cancelable": false
        });

        element.dispatchEvent(clickEvent);
    }

    var PROCESSED_CLASS = "cv-key-processed", isPopupOpen = false, currentPopup, popupTitle = "";

    // I wouldn't need this if I can dynamically detect whether a popup is open or not
    // turns out all types of popups have different IDs
    // so I just need to make a hardcoded list of all of them
    // Suggested Edits/Close/Recmnd Deletion/Unsalvageable (Triage)
    // interestingly, when these popups are not shown, they are entirely removed from the DOM (not hidden via CSS)
    // (exception: Unsalvageable(Triage) flagging then closure)

    var POPUP_IDS = {
        rejectEdit: "rejection-popup",
        closeQuestion: "popup-close-question",
        recommendDeletion: "delete-question-popup",
        flag: "popup-flag-post"
    };

    function id(idName){
        return "#" + idName;
    }


    function getVisiblePopup(){
        var popup = null;

        for(var key in POPUP_IDS)
            if(POPUP_IDS.hasOwnProperty(key)){
                popup = $(id(POPUP_IDS[key]));
                if(!popup) continue;

                // pressing "should be closed..." in flagging dialog
                // opens the close dialog and does "display:none;" to the flag dialog
                // (so that both popups are in the DOM at once)
                // and also vice-versa
                if(popup.style && popup.style.display === "none")
                    continue;

                return popup;
            }

        return null;


        if(popup.id === POPUP_IDS.flagDialog)
            if(popup.style && popup.style.display === "none")
                return $("#" + POPUP_IDS.closeQuestion);

        return popup;
    }

    /* Steps:
    1. find all buttons on a review page (under `span.review-actions`)
    2. assign them keyboard shortcuts
    3. look for cases
    TREES OF SUPPORT:
    (these are just for indication but should NOT be hardcoded
      into the script. this is the entire reason why I'm writing this script,
      to avoid hardcoding)
    CLOSE -
     - duplicate
     - off topic
       - several reasons
       - migration
         - several sites
       - custom
     - unclear what you're asking
     - too broad
     - primarily opinion based
     EDIT-
      - Approve
      - Improve Edit
      - Reject and Edit
      - Reject
        - four normal reasons
        - fifth custom reason
      - Skip
      LQP -
       - Looks OK
       - Edit
       - Recmnd deletion
        - several other options
       - Skip
      I guess this tree is enough. My code should be
      intelligent enough to work on all queues (hopefully?)
      for that it would also need to detect when a modal opens automatically
    */

    // for review actions, tacking on a .processed class doesn't work
    // because that class persists when you move from one review item to another
    // (watching for mutation.childList hasn't been helpful either)
    function hasActionsBeenProcessed(actions){
        return /\[1\]/.test(actions.children[0].value);
    }

    function setReviewActionKeys(){
        var actions = $(".review-actions");

        if(hasActionsBeenProcessed(actions)) return;

        var key = 1;
        forEach(actions.children, function(button){
            button.value = "[" + key + "] " + button.value;
            key++;
        });
        actions.classList.add(PROCESSED_CLASS);

    }

    // actually there's more than one `.action-list`, one for every list
    // I need to determine which `.action-list` is visible at the moment
    function getVisibleActionList(){
        // only queues with more than one pane have the `.popup-active-pane` set
        return currentPopup.querySelector(".popup-active-pane .action-list") ||
                currentPopup.querySelector(".action-list");
    }

    function setPopupKeys(){
        var actionList = getVisibleActionList(), key = 1, span;

        if(hasClass(actionList, PROCESSED_CLASS)) return;

        forEach(actionList.children, function(li){
            span = li.querySelector(".action-name");
            span.innerHTML = "[" + key + "] " + span.innerHTML;
            key++;
        });
        actionList.classList.add(PROCESSED_CLASS);
    }

    // for example, go from Closing > Off-Topic > Migration to Closing > Off-Topic
    // on pressing Backspace key
    function backStepPopup(){
        // you don't have any popup open
        if(!currentPopup) return;

        var breadcrumbs = currentPopup.querySelector(".popup-breadcrumbs"),
            children = breadcrumbs.children, len = children.length;

        // you are on the front page
        if(len === 0) return;

        invokeClick(children[len - 1].querySelector("a"));
    }

    function onStateChange(){
        var popup = getVisiblePopup(), titleElm, title = "";

        if(popup){
            isPopupOpen = true;
            // only in CV queue
            titleElm = popup.querySelector(".popup-title");
            if(titleElm) title = titleElm.innerHTML;

            if(popup === currentPopup) {
                if(title != popupTitle){
                    popupTitle = title;
                    setPopupKeys();
                }
            }else{
                currentPopup = popup;
                setPopupKeys();
            }
        }else{
            isPopupOpen = false;
            setReviewActionKeys();
        }
    }


    function numKeyHandler(keyCode){
        // starts from 1
        var num = keyCode - 48, focusedElement, radioBtn, reviewActions = $(".review-actions");

        if(isPopupOpen){
            focusedElement = getVisibleActionList().children[num - 1].querySelector("input");
            focusedElement.focus();
            invokeClick(focusedElement);
        }else if(reviewActions){
            // rely on jQuery
            focusedElement = reviewActions.children[num - 1];
            focusedElement.focus();
            invokeClick(focusedElement);
        }else{
            console.warn("Possible page reloading");
        }
    }

    try{
        var observer = new MutationObserver(function (mutations) {
            onStateChange();
            setReviewActionKeys();
        });

        // watching #content because #rejection-popup happens to fall outisde .review-content
        observer.observe($('#content'), { 'childList': true, 'subtree': true });
        observer.observe($('.review-content'), { 'childList': true, 'subtree': true });
    }catch(e){
        // when user moving from one review item to another, an error comes up
        // claiming element X is undefined. Don't need to care about that error
    }

    // adding prefixes to button values causes them to overflow to two lines, so avoid that
    var style = document.createElement("style"),
        styles = `
        .review-summary{
            flex: 0 1 40% !important;
        }
        .review-actions-container{
            flex: 0 1 60% !important;
        }`;
    style.innerHTML = styles;
    document.head.appendChild(style);

    document.addEventListener('keyup', function (e) {
        var target = e.target, kC = e.keyCode;

        // escape
        if(kC === 27) return;

        // do not register inputs in textareas
        if((target.tagName === 'INPUT' && target.type === 'text') || target.tagName === 'TEXTAREA') return;

        // backspace
        if(kC === 8) backStepPopup();

        // numpad handling - reset to values in topbar
        if(kC > 95 && kC < 106) kC -= 48;

        // 1 - 9
        if(kC > 48 && kC < 58) numKeyHandler(kC);
    });
})();
