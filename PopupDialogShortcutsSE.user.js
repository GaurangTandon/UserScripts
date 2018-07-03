// ==UserScript==
// @name         Popup dialog shortcuts for Stack Exchange
// @description  better version of CloseVoteShortcuts,  works on all SE sites, in all queues (close/reopen/etc.), on all pages (review and non-review)
// @version      1.0.0
// @author       Gaurang Tandon
// @match        *://*.askubuntu.com/*
// @match        *://*.mathoverflow.net/*
// @match        *://*.serverfault.com/*
// @match        *://*.stackapps.com/*
// @match        *://*.stackexchange.com/*
// @match        *://*.stackoverflow.com/*
// @match        *://*.superuser.com/*
// @exclude      *://chat.stackexchange.com/*
// @exclude      *://chat.stackoverflow.com/*
// @exclude      *://api.stackexchange.com/*
// @exclude      *://blog.stackexchange.com/*
// @exclude      *://blog.stackoverflow.com/*
// @exclude      *://data.stackexchange.com/*
// @exclude      *://elections.stackexchange.com/*
// @exclude      *://openid.stackexchange.com/*
// @exclude      *://stackexchange.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function q(selector){
        var elms = document.querySelectorAll(selector),
            elm,
            len = elms.length;

        // cannot always return a NodeList/Array
        // as properties like firstChild, lastChild will only be able
        // to be accessed by elms[0].lastChild which is too cumbersome
        if(len === 0) {
            return null;
        }
        else if (len === 1) {
            elm = elms[0];
            // so that I can access the length of the returned
            // value else length if undefined
            elm.length = 1;
            return elm;
        }
        else {
            return elms;
        }
    }

    function qID(id){
        return document.getElementById(id);
    }

    function hasClass(node, className){
        return node.classList.contains(className);
    }

    function forEach(nodeList, fn){
        var i = 0,
            len = nodeList.length;

        for(; i < len; i++){
            fn.call(this, nodeList[i]);
        }
    }

    function throttle(fn, countMax, time){
        var counter = 0;

        setInterval(function(){ counter = 0; }, time);

        return function(){
            if(counter < countMax) {
                counter++;
                fn.apply(this, arguments);
            }
        };
    }

    var PROCESSED_CLASS = "cv-key-processed",
        isPopupOpen = false,
        currentPopup,
        popupTitle = "",
        isReviewQueuePage = /\/review/.test(window.location.href);

    // I wouldn't need this if I can dynamically detect whether a popup is open or not
    // turns out all types of popups have different IDs
    // interestingly, when these popups are not shown, they are entirely removed from the DOM (not hidden via CSS)
    // (exception: Unsalvageable (Triage) flagging then closure, hidden by style="display:none;")

    // The various POPUP_IDs are:
    // rejectEdit: "rejection-popup", closeQuestion: "popup-close-question", recommendDeletion: "delete-question-popup", flag: "popup-flag-post"
    // The following method relies on the (hardcoded?) fact that the visible popup
    // would definitely be a "div.popup[id*="popup"]" with its "style.display" not set to none
    function getVisiblePopup(){
        var popupsInDOM = document.querySelectorAll("div.popup[id*='popup']") || [];

        for(var i = 0, len = popupsInDOM.length, popup; i < len; i++){
            popup = popupsInDOM[i];

            if(!(popup.style && popup.style.display === "none")){
                return popup;
            }
        }

        return null;
    }

    // for review actions, tacking on a .processed class doesn't work
    // because that class persists when you move from one review item to another
    // (watching for mutation.childList hasn't been helpful either)
    function hasActionsBeenProcessed(actions){
        return /\[1\]/.test(actions.children[0].value);
    }

    function setReviewActionKeys(){
        var actions = q(".review-actions");

        if(hasActionsBeenProcessed(actions)) {
            return;
        }

        var key = 1;
        forEach(actions.children, function(button){
            button.value = "[" + key + "] " + button.value;
            key++;
        });
        actions.classList.add(PROCESSED_CLASS);
    }

    // there's more than one `.action-list`, one for every parent pane
    // I need to determine which `.action-list` is visible at the moment
    function getVisibleActionList(){
        // only queues with more than one pane have the `.popup-active-pane` set
        return currentPopup.querySelector(".popup-active-pane .action-list") ||
                currentPopup.querySelector(".action-list");
    }

    function setPopupKeys(){
        var actionList = getVisibleActionList(),
            key = 1,
            span;

        if(!actionList || hasClass(actionList, PROCESSED_CLASS)) {
            return;
        }

        // in the LQP queue, the first option is selected by default
        // however, pressing the Enter key doesn't submit the popup
        // as the input element of the selection action is not focused
        var preSelectedActionInput = actionList.querySelector(".action-selected input");

        forEach(actionList.children, function(li){
            span = li.querySelector(".action-name");
            span.innerHTML = "[" + key + "] " + span.innerHTML;
            key++;
        });
        actionList.classList.add(PROCESSED_CLASS);

        if(preSelectedActionInput){
            preSelectedActionInput.focus();
            preSelectedActionInput.click();
        }
    }

    // for example, go from Closing > Off-Topic > Migration to Closing > Off-Topic
    // on pressing Backspace key
    function backStepPopup(event){
        function exitPopup(){
            currentPopup.querySelector(".popup-close a").click();
        }

        // you don't have any popup open
        if(!currentPopup) {
            return;
        }

        event.preventDefault();

        var breadcrumbs = currentPopup.querySelector(".popup-breadcrumbs");

        // breadcrumbs are missing on the flag dialog
        if(!breadcrumbs){
            exitPopup();
        }

        var children = breadcrumbs.children,
            len = children.length;

        // you are on the front page, exit popup
        if(!len) {
            exitPopup();
        }
        else{
            children[len - 1].querySelector("a").click();
        }
    }

    function onStateChange(){
        var popup = getVisiblePopup(),
            titleElm,
            title = "";

        if(popup){
            isPopupOpen = true;
            // only in CV queue
            titleElm = popup.querySelector(".popup-title");
            if(titleElm) {
                title = titleElm.innerHTML;
            }

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
            if(isReviewQueuePage){
                setReviewActionKeys();
            }
        }
    }

    function numKeyHandler(event){
        // starts from 1
        var num = event.keyCode - 48,
            reviewActions = q(".review-actions"),
            focusedElement = isPopupOpen ? getVisibleActionList().children[num - 1].querySelector("input") :
                             reviewActions ? reviewActions.children[num - 1] : null;

        if(focusedElement){
            event.preventDefault();
            focusedElement.focus();
            focusedElement.click();
        }else{
            console.warn("Possible page reloading");
        }
    }

    try{
        var observer = new MutationObserver(throttle(onStateChange, 1, 250));

        // watching #content because #rejection-popup happens to fall outisde .review-content
        observer.observe(qID('content'), { 'childList': true, 'subtree': true });
        observer.observe(q('.review-content'), { 'childList': true, 'subtree': true });
    }catch(e){
        // when user moving from one review item to another, an error comes up
        // claiming element X is undefined. Don't need to care about that error
    }

    // adding numeric prefixes to button values causes them to overflow to two lines, so avoid that
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

    // for some unknown reason, using keydown gives `focusedElement` as undefined in `numKeyHandler`
    document.addEventListener('keypress', function handleKeyPress(e) {
        var target = e.target,
            kC = e.keyCode;

        // escape
        if(kC === 27 ||
          // do not register inputs in textareas
          (target.tagName === 'INPUT' && target.type === 'text') || target.tagName === 'TEXTAREA') {
            return;
        }

        // backspace
        if(kC === 8) {
            backStepPopup(e);
        }

        // numpad handling - reset to values in topbar
        if(kC > 95 && kC < 106) {
            kC -= 48;
        }

        // 1 - 9
        if(kC > 48 && kC < 58) {
            numKeyHandler(e);
        }
    });
})();
