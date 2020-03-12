/*
 * Copyright (c) 2020.
 * Author: hirosume.
 * LastModifiedAt: 3/12/20, 10:40 AM.
 */

const conversationModel = require('../models/conversation');
const userModel = require('../models/user');
const { sendSetGenderSuccessful } = require('./util');
const { sendWaitToSetGender } = require('./util');
const { sendNotSupportedGenderSetting } = require('./util');
const { sendAlreadyConversation } = require('./util');
const { sendJoined } = require('./util');
const { sendIsQueueing } = require('./util');
const { sendUserNotFound } = require('./util');
const { getUser } = require('./util');
const { sendLeaveConversation, sendConversationNotFound } = require('./util');


module.exports.procPostback = function(psid, payload) {
    const subject = payload.subject;
    switch (subject) {
        case 'quit': {
            return quit(psid);
        }
        case 'join': {
            return join(psid);
        }
        case 'set-gender': {
            return setGender(psid, payload.data);
        }
    }
};
module.exports.join = join;
module.exports.quit = quit;

const twentyTwoHour = 24 * 60 * 60 * 1000;

async function setGender(psid, data) {
    const user = await getUser(psid);
    if (user) {
        if (~['male', 'female', 'unknown'].indexOf(data)) {
            if (user.lastSetGender && Date.now() - twentyTwoHour < new Date(user.lastSetGender).getTime()) {
                user.lastSetGender = new Date();
                user.gender = data;
                await user.save();
                await sendSetGenderSuccessful(psid, data);
            } else {
                await sendWaitToSetGender(psid);
            }
        } else {
            return sendNotSupportedGenderSetting(psid);
        }
    } else {
        return sendUserNotFound(psid);
    }
}

async function join(psid) {
    const user = await getUser(psid);
    if (user) {
        const conversation = await conversationModel.getAliveConversation(psid);
        if (conversation) {
            return sendAlreadyConversation(psid);
        }
        await userModel.setQueue(psid);
        const friend = await userModel.findFriend(psid);
        if (friend) {
            const members = [user.psid, friend.psid];
            for (let psid of members) {
                await userModel.setNotQueue(psid);
            }
            await conversationModel.createConversation(members);
            await sendJoined(members);
        } else {
            return sendIsQueueing(psid);
        }
    } else {
        return sendUserNotFound(psid);
    }
}

async function quit(psid) {
    const conversation = await conversationModel.getAliveConversation(psid);
    if (conversation) {
        console.log(conversation);
        await conversationModel.leaveConversation(conversation._id);
        return sendLeaveConversation(psid);
    } else {
        return sendConversationNotFound(psid);
    }
}

