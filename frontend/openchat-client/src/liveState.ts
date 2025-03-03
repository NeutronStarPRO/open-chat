import type {
    AuthProvider,
    ChatEvent,
    ChatIdentifier,
    ChatMap,
    ChatSummary,
    CommunitySummary,
    CommunityMap,
    DiamondMembershipDetails,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    Message,
    MessageContext,
    ThreadSyncDetails,
    UserLookup,
    MultiUserChat,
    ChatListScope,
    Member,
    VersionedRules,
    CreatedUser,
} from "openchat-shared";
import { selectedAuthProviderStore } from "./stores/authProviders";
import {
    serverChatSummariesStore,
    myServerChatSummariesStore,
    chatSummariesStore,
    groupPreviewsStore,
    selectedChatId,
    eventsStore,
    selectedChatStore,
    selectedServerChatStore,
    currentChatReplyingTo,
    chatSummariesListStore,
    threadsByChatStore,
    focusMessageIndex,
    focusThreadMessageIndex,
    threadEvents,
    threadsFollowedByMeStore,
    currentChatUserIds,
    selectedThreadRootMessageIndex,
    chatsInitialised,
    chatsLoading,
    uninitializedDirectChats,
    confirmedThreadEventIndexesLoadedStore,
    selectedThreadRootEvent,
    selectedMessageContext,
    allChats,
    currentChatMembers,
    currentChatDraftMessage,
    currentChatRules,
} from "./stores/chat";
import { remainingStorage } from "./stores/storage";
import { userCreatedStore } from "./stores/userCreated";
import { anonUser, currentUser, platformModerator, suspendedUser, userStore } from "./stores/user";
import { blockedUsers } from "./stores/blockedUsers";
import { diamondMembership, isDiamond } from "./stores/diamond";
import type DRange from "drange";
import {
    communities,
    communityPreviewsStore,
    currentCommunityMembers,
    selectedCommunity,
    currentCommunityRules,
} from "./stores/community";
import { type GlobalState, chatListScopeStore, globalStateStore } from "./stores/global";
import type { DraftMessage, DraftMessagesByThread } from "./stores/draftMessageFactory";
import { draftThreadMessages } from "./stores/draftThreadMessages";
import { offlineStore } from "./stores/network";

/**
 * Any stores that we reference inside the OpenChat client can be added here so that we always have the up to date current value
 * at hand without having to use svelte.get which will create and destroy a subscription every time
 */
export class LiveState {
    selectedChat: ChatSummary | undefined;
    selectedServerChat: ChatSummary | undefined;
    events!: EventWrapper<ChatEvent>[];
    selectedAuthProvider!: AuthProvider;
    userCreated!: boolean;
    userStore!: UserLookup;
    remainingStorage!: number;
    currentChatReplyingTo: EnhancedReplyContext | undefined;
    serverChatSummaries!: ChatMap<ChatSummary>;
    myServerChatSummaries!: ChatMap<ChatSummary>;
    chatSummaries!: ChatMap<ChatSummary>;
    uninitializedDirectChats!: ChatMap<DirectChatSummary>;
    groupPreviews!: ChatMap<MultiUserChat>;
    communityPreviews!: CommunityMap<CommunitySummary>;
    selectedChatId: ChatIdentifier | undefined;
    chatSummariesList!: ChatSummary[];
    threadsByChat!: ChatMap<ThreadSyncDetails[]>;
    focusMessageIndex: number | undefined;
    focusThreadMessageIndex: number | undefined;
    threadEvents!: EventWrapper<ChatEvent>[];
    selectedMessageContext: MessageContext | undefined;
    selectedThreadRootEvent: EventWrapper<Message> | undefined;
    threadsFollowedByMe!: ChatMap<Set<number>>;
    currentChatMembers!: Member[];
    currentChatRules!: VersionedRules | undefined;
    currentChatUserIds!: Set<string>;
    selectedThreadRootMessageIndex: number | undefined;
    chatsInitialised!: boolean;
    chatsLoading!: boolean;
    blockedUsers!: Set<string>;
    diamondMembership!: DiamondMembershipDetails | undefined;
    isDiamond!: boolean;
    confirmedThreadEventIndexesLoaded!: DRange;
    communities!: CommunityMap<CommunitySummary>;
    chatListScope!: ChatListScope;
    globalState!: GlobalState;
    allChats!: ChatMap<ChatSummary>;
    selectedCommunity!: CommunitySummary | undefined;
    currentCommunityMembers!: Map<string, Member>;
    currentChatDraftMessage!: DraftMessage | undefined;
    draftThreadMessages!: DraftMessagesByThread;
    currentCommunityRules!: VersionedRules | undefined;
    user!: CreatedUser;
    anonUser!: boolean;
    suspendedUser!: boolean;
    platformModerator!: boolean;
    offlineStore!: boolean;

    constructor() {
        offlineStore.subscribe((offline) => (this.offlineStore = offline));
        currentUser.subscribe((user) => (this.user = user));
        anonUser.subscribe((anon) => (this.anonUser = anon));
        suspendedUser.subscribe((suspended) => (this.suspendedUser = suspended));
        platformModerator.subscribe((mod) => (this.platformModerator = mod));
        confirmedThreadEventIndexesLoadedStore.subscribe(
            (data) => (this.confirmedThreadEventIndexesLoaded = data),
        );
        remainingStorage.subscribe((data) => (this.remainingStorage = data));
        userStore.subscribe((data) => (this.userStore = data));
        userCreatedStore.subscribe((data) => (this.userCreated = data));
        selectedAuthProviderStore.subscribe((data) => (this.selectedAuthProvider = data));
        serverChatSummariesStore.subscribe((data) => (this.serverChatSummaries = data));
        myServerChatSummariesStore.subscribe((data) => (this.myServerChatSummaries = data));
        chatSummariesStore.subscribe((data) => (this.chatSummaries = data));
        uninitializedDirectChats.subscribe((data) => (this.uninitializedDirectChats = data));
        groupPreviewsStore.subscribe((data) => (this.groupPreviews = data));
        communityPreviewsStore.subscribe((data) => (this.communityPreviews = data));
        selectedChatId.subscribe((data) => (this.selectedChatId = data));
        eventsStore.subscribe((data) => (this.events = data));
        selectedChatStore.subscribe((data) => (this.selectedChat = data));
        selectedServerChatStore.subscribe((data) => (this.selectedServerChat = data));
        currentChatReplyingTo.subscribe((data) => (this.currentChatReplyingTo = data));
        chatSummariesListStore.subscribe((data) => (this.chatSummariesList = data));
        threadsByChatStore.subscribe((data) => (this.threadsByChat = data));
        focusMessageIndex.subscribe((data) => (this.focusMessageIndex = data));
        focusThreadMessageIndex.subscribe((data) => (this.focusThreadMessageIndex = data));
        threadEvents.subscribe((data) => (this.threadEvents = data));
        selectedMessageContext.subscribe((data) => (this.selectedMessageContext = data));
        selectedThreadRootEvent.subscribe((data) => (this.selectedThreadRootEvent = data));
        threadsFollowedByMeStore.subscribe((data) => (this.threadsFollowedByMe = data));
        currentChatMembers.subscribe((data) => (this.currentChatMembers = data));
        currentChatRules.subscribe((data) => (this.currentChatRules = data));
        currentChatUserIds.subscribe((data) => (this.currentChatUserIds = data));
        selectedThreadRootMessageIndex.subscribe(
            (data) => (this.selectedThreadRootMessageIndex = data),
        );
        chatsInitialised.subscribe((data) => (this.chatsInitialised = data));
        chatsLoading.subscribe((data) => (this.chatsLoading = data));
        blockedUsers.subscribe((data) => (this.blockedUsers = data));
        diamondMembership.subscribe((data) => (this.diamondMembership = data));
        isDiamond.subscribe((data) => (this.isDiamond = data));
        communities.subscribe((data) => (this.communities = data));
        chatListScopeStore.subscribe((scope) => (this.chatListScope = scope));
        globalStateStore.subscribe((data) => (this.globalState = data));
        allChats.subscribe((data) => (this.allChats = data));
        selectedCommunity.subscribe((data) => (this.selectedCommunity = data));
        currentCommunityMembers.subscribe((data) => (this.currentCommunityMembers = data));
        currentChatDraftMessage.subscribe((data) => (this.currentChatDraftMessage = data));
        draftThreadMessages.subscribe((data) => (this.draftThreadMessages = data));
        currentCommunityRules.subscribe((data) => (this.currentCommunityRules = data));
    }
}
