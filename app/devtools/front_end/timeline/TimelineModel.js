/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @param {!WebInspector.TracingManager} tracingManager
 * @param {!WebInspector.TracingModel} tracingModel
 * @param {!WebInspector.TimelineModel.Filter} recordFilter
 * @extends {WebInspector.Object}
 */
WebInspector.TimelineModel = function(tracingManager, tracingModel, recordFilter)
{
    WebInspector.Object.call(this);
    this._filters = [];
    this._tracingManager = tracingManager;
    this._tracingModel = tracingModel;
    this._recordFilter = recordFilter;
    this._tracingManager.addEventListener(WebInspector.TracingManager.Events.TracingStarted, this._onTracingStarted, this);
    this._tracingManager.addEventListener(WebInspector.TracingManager.Events.EventsCollected, this._onEventsCollected, this);
    this._tracingManager.addEventListener(WebInspector.TracingManager.Events.TracingComplete, this._onTracingComplete, this);
    this.reset();
}

WebInspector.TimelineModel.RecordType = {
    Program: "Program",
    EventDispatch: "EventDispatch",

    GPUTask: "GPUTask",

    RequestMainThreadFrame: "RequestMainThreadFrame",
    BeginFrame: "BeginFrame",
    BeginMainThreadFrame: "BeginMainThreadFrame",
    ActivateLayerTree: "ActivateLayerTree",
    DrawFrame: "DrawFrame",
    ScheduleStyleRecalculation: "ScheduleStyleRecalculation",
    RecalculateStyles: "RecalculateStyles",
    InvalidateLayout: "InvalidateLayout",
    Layout: "Layout",
    UpdateLayer: "UpdateLayer",
    UpdateLayerTree: "UpdateLayerTree",
    PaintSetup: "PaintSetup",
    Paint: "Paint",
    PaintImage: "PaintImage",
    Rasterize: "Rasterize",
    RasterTask: "RasterTask",
    ScrollLayer: "ScrollLayer",
    CompositeLayers: "CompositeLayers",

    StyleRecalcInvalidationTracking: "StyleRecalcInvalidationTracking",
    LayoutInvalidationTracking: "LayoutInvalidationTracking",
    LayerInvalidationTracking: "LayerInvalidationTracking",
    PaintInvalidationTracking: "PaintInvalidationTracking",

    ParseHTML: "ParseHTML",
    ParseAuthorStyleSheet: "ParseAuthorStyleSheet",

    TimerInstall: "TimerInstall",
    TimerRemove: "TimerRemove",
    TimerFire: "TimerFire",

    XHRReadyStateChange: "XHRReadyStateChange",
    XHRLoad: "XHRLoad",
    EvaluateScript: "EvaluateScript",

    MarkLoad: "MarkLoad",
    MarkDOMContent: "MarkDOMContent",
    MarkFirstPaint: "MarkFirstPaint",

    TimeStamp: "TimeStamp",
    ConsoleTime: "ConsoleTime",

    ResourceSendRequest: "ResourceSendRequest",
    ResourceReceiveResponse: "ResourceReceiveResponse",
    ResourceReceivedData: "ResourceReceivedData",
    ResourceFinish: "ResourceFinish",

    FunctionCall: "FunctionCall",
    GCEvent: "GCEvent",
    JSFrame: "JSFrame",
    JSSample: "JSSample",

    UpdateCounters: "UpdateCounters",

    RequestAnimationFrame: "RequestAnimationFrame",
    CancelAnimationFrame: "CancelAnimationFrame",
    FireAnimationFrame: "FireAnimationFrame",

    WebSocketCreate : "WebSocketCreate",
    WebSocketSendHandshakeRequest : "WebSocketSendHandshakeRequest",
    WebSocketReceiveHandshakeResponse : "WebSocketReceiveHandshakeResponse",
    WebSocketDestroy : "WebSocketDestroy",

    EmbedderCallback : "EmbedderCallback",

    CallStack: "CallStack",
    SetLayerTreeId: "SetLayerTreeId",
    TracingStartedInPage: "TracingStartedInPage",
    TracingSessionIdForWorker: "TracingSessionIdForWorker",

    DecodeImage: "Decode Image",
    ResizeImage: "Resize Image",
    DrawLazyPixelRef: "Draw LazyPixelRef",
    DecodeLazyPixelRef: "Decode LazyPixelRef",

    LazyPixelRef: "LazyPixelRef",
    LayerTreeHostImplSnapshot: "cc::LayerTreeHostImpl",
    PictureSnapshot: "cc::Picture",

    // CpuProfile is a virtual event created on frontend to support
    // serialization of CPU Profiles within tracing timeline data.
    CpuProfile: "CpuProfile"
}

WebInspector.TimelineModel.Events = {
    RecordsCleared: "RecordsCleared",
    RecordingStarted: "RecordingStarted",
    RecordingStopped: "RecordingStopped",
    RecordFilterChanged: "RecordFilterChanged"
}

WebInspector.TimelineModel.MainThreadName = "main";

/**
 * @param {!Array.<!WebInspector.TimelineModel.Record>} recordsArray
 * @param {?function(!WebInspector.TimelineModel.Record)|?function(!WebInspector.TimelineModel.Record,number)} preOrderCallback
 * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)=} postOrderCallback
 * @return {boolean}
 */
WebInspector.TimelineModel.forAllRecords = function(recordsArray, preOrderCallback, postOrderCallback)
{
    /**
     * @param {!Array.<!WebInspector.TimelineModel.Record>} records
     * @param {number} depth
     * @return {boolean}
     */
    function processRecords(records, depth)
    {
        for (var i = 0; i < records.length; ++i) {
            var record = records[i];
            if (preOrderCallback && preOrderCallback(record, depth))
                return true;
            if (processRecords(record.children(), depth + 1))
                return true;
            if (postOrderCallback && postOrderCallback(record, depth))
                return true;
        }
        return false;
    }
    return processRecords(recordsArray, 0);
}

WebInspector.TimelineModel.TransferChunkLengthBytes = 5000000;

/**
 * @constructor
 * @param {string} name
 */
WebInspector.TimelineModel.VirtualThread = function(name)
{
    this.name = name;
    /** @type {!Array.<!WebInspector.TracingModel.Event>} */
    this.events = [];
    /** @type {!Array.<!Array.<!WebInspector.TracingModel.Event>>} */
    this.asyncEvents = [];
}

/**
 * @constructor
 * @param {!WebInspector.TimelineModel} model
 * @param {!WebInspector.TracingModel.Event} traceEvent
 */
WebInspector.TimelineModel.Record = function(model, traceEvent)
{
    this._model = model;
    this._event = traceEvent;
    traceEvent._timelineRecord = this;
    this._children = [];
}

WebInspector.TimelineModel.Record.prototype = {
    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    callSiteStackTrace: function()
    {
        var initiator = this._event.initiator;
        return initiator ? initiator.stackTrace : null;
    },

    /**
     * @return {?WebInspector.TimelineModel.Record}
     */
    initiator: function()
    {
        var initiator = this._event.initiator;
        return initiator ? initiator._timelineRecord : null;
    },

    /**
     * @return {?WebInspector.Target}
     */
    target: function()
    {
        return this._event.thread.target();
    },

    /**
     * @return {number}
     */
    selfTime: function()
    {
        return this._event.selfTime;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    children: function()
    {
        return this._children;
    },

    /**
     * @return {number}
     */
    startTime: function()
    {
        return this._event.startTime;
    },

    /**
     * @return {string}
     */
    thread: function()
    {
        if (this._event.thread.name() === "CrRendererMain")
            return WebInspector.TimelineModel.MainThreadName;
        return this._event.thread.name();
    },

    /**
     * @return {number}
     */
    endTime: function()
    {
        return this._endTime || this._event.endTime || this._event.startTime;
    },

    /**
     * @param {number} endTime
     */
    setEndTime: function(endTime)
    {
        this._endTime = endTime;
    },

    /**
     * @return {!Object}
     */
    data: function()
    {
        return this._event.args["data"];
    },

    /**
     * @return {string}
     */
    type: function()
    {
        if (this._event.category === WebInspector.TracingModel.ConsoleEventCategory)
            return WebInspector.TimelineModel.RecordType.ConsoleTime;
        return this._event.name;
    },

    /**
     * @return {string}
     */
    frameId: function()
    {
        switch (this._event.name) {
        case WebInspector.TimelineModel.RecordType.ScheduleStyleRecalculation:
        case WebInspector.TimelineModel.RecordType.RecalculateStyles:
        case WebInspector.TimelineModel.RecordType.InvalidateLayout:
            return this._event.args["frameId"];
        case WebInspector.TimelineModel.RecordType.Layout:
            return this._event.args["beginData"]["frameId"];
        default:
            var data = this._event.args["data"];
            return (data && data["frame"]) || "";
        }
    },

    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    stackTrace: function()
    {
        return this._event.stackTrace;
    },

    /**
     * @param {string} key
     * @return {?Object}
     */
    getUserObject: function(key)
    {
        if (key === "TimelineUIUtils::preview-element")
            return this._event.previewElement;
        throw new Error("Unexpected key: " + key);
    },

    /**
     * @param {string} key
     * @param {?Object|undefined} value
     */
    setUserObject: function(key, value)
    {
        if (key !== "TimelineUIUtils::preview-element")
            throw new Error("Unexpected key: " + key);
        this._event.previewElement = /** @type {?Element} */ (value);
    },

    /**
     * @return {?Array.<string>}
     */
    warnings: function()
    {
        if (this._event.warning)
            return [this._event.warning];
        return null;
    },

    /**
     * @return {!WebInspector.TracingModel.Event}
     */
    traceEvent: function()
    {
        return this._event;
    },

    /**
     * @param {!WebInspector.TimelineModel.Record} child
     */
    _addChild: function(child)
    {
        this._children.push(child);
        child.parent = this;
    },

    /**
     * @return {!WebInspector.TimelineModel}
     */
    timelineModel: function()
    {
        return this._model;
    }
}

WebInspector.TimelineModel.prototype = {
    /**
     * @param {boolean} captureCauses
     * @param {boolean} enableJSSampling
     * @param {boolean} captureMemory
     * @param {boolean} capturePictures
     */
    startRecording: function(captureCauses, enableJSSampling, captureMemory, capturePictures)
    {
        function disabledByDefault(category)
        {
            return "disabled-by-default-" + category;
        }
        var categoriesArray = [
            "-*",
            disabledByDefault("devtools.timeline"),
            disabledByDefault("devtools.timeline.frame"),
            WebInspector.TracingModel.ConsoleEventCategory
        ];
        if (captureCauses || enableJSSampling)
            categoriesArray.push(disabledByDefault("devtools.timeline.stack"));
        if (enableJSSampling)
            this._startCpuProfilingOnAllTargets();
        if (captureCauses && Runtime.experiments.isEnabled("timelineInvalidationTracking"))
            categoriesArray.push(disabledByDefault("devtools.timeline.invalidationTracking"));
        if (capturePictures) {
            categoriesArray = categoriesArray.concat([
                disabledByDefault("devtools.timeline.layers"),
                disabledByDefault("devtools.timeline.picture"),
                disabledByDefault("blink.graphics_context_annotations")]);
        }
        var categories = categoriesArray.join(",");
        this._startRecordingWithCategories(categories);
    },

    stopRecording: function()
    {
        this._stopCallbackBarrier = new CallbackBarrier();
        this._stopProfilingOnAllTargets();
        this._tracingManager.stop();
    },

    /**
     * @param {?function(!WebInspector.TimelineModel.Record)|?function(!WebInspector.TimelineModel.Record,number)} preOrderCallback
     * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)=} postOrderCallback
     */
    forAllRecords: function(preOrderCallback, postOrderCallback)
    {
        WebInspector.TimelineModel.forAllRecords(this._records, preOrderCallback, postOrderCallback);
    },

    /**
     * @param {!WebInspector.TimelineModel.Filter} filter
     */
    addFilter: function(filter)
    {
        this._filters.push(filter);
        filter._model = this;
    },

    /**
     * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)} callback
     */
    forAllFilteredRecords: function(callback)
    {
        /**
         * @param {!WebInspector.TimelineModel.Record} record
         * @param {number} depth
         * @this {WebInspector.TimelineModel}
         * @return {boolean}
         */
        function processRecord(record, depth)
        {
            var visible = this.isVisible(record);
            if (visible) {
                if (callback(record, depth))
                    return true;
            }

            for (var i = 0; i < record.children().length; ++i) {
                if (processRecord.call(this, record.children()[i], visible ? depth + 1 : depth))
                    return true;
            }
            return false;
        }

        for (var i = 0; i < this._records.length; ++i)
            processRecord.call(this, this._records[i], 0);
    },

    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    isVisible: function(record)
    {
        for (var i = 0; i < this._filters.length; ++i) {
            if (!this._filters[i].accept(record))
                return false;
        }
        return true;
    },

    _filterChanged: function()
    {
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordFilterChanged);
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    records: function()
    {
        return this._records;
    },

    /**
     * @return {?WebInspector.Target}
     */
    target: function()
    {
        // FIXME: Consider returning null for loaded traces.
        return this._tracingManager.target();
    },

    /**
     * @param {!Array.<!WebInspector.TracingManager.EventPayload>} events
     */
    setEventsForTest: function(events)
    {
        this._startCollectingTraceEvents(false);
        this._tracingModel.addEvents(events);
        this._onTracingComplete();
    },

    _startCpuProfilingOnAllTargets: function()
    {
        this._profilingTargets = WebInspector.targetManager.targets();
        for (var i = 0; i < this._profilingTargets.length; ++i) {
            var target = this._profilingTargets[i];
            this._configureCpuProfilerSamplingInterval(target);
            target.profilerAgent().start();
        }
    },

    _stopProfilingOnAllTargets: function()
    {
        if (!this._profilingTargets)
            return;
        for (var i = 0; i < this._profilingTargets.length; ++i) {
            var target = this._profilingTargets[i];
            target.profilerAgent().stop(this._stopCallbackBarrier.createCallback(this._didStopRecordingJSSamples.bind(this, target)));
        }
        this._profilingTargets = null;
    },

    /**
     * @param {!WebInspector.Target} target
     */
    _configureCpuProfilerSamplingInterval: function(target)
    {
        var intervalUs = WebInspector.settings.highResolutionCpuProfiling.get() ? 100 : 1000;
        target.profilerAgent().setSamplingInterval(intervalUs, didChangeInterval);

        function didChangeInterval(error)
        {
            if (error)
                WebInspector.console.error(error);
        }
    },

    /**
     * @param {string} categories
     */
    _startRecordingWithCategories: function(categories)
    {
        this._tracingManager.start(categories, "");
    },

    _onTracingStarted: function()
    {
        this._startCollectingTraceEvents(false);
    },

    /**
     * @param {boolean} fromFile
     */
    _startCollectingTraceEvents: function(fromFile)
    {
        this.reset();
        this._tracingModel.reset();
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordingStarted, { fromFile: fromFile });
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onEventsCollected: function(event)
    {
        var traceEvents = /** @type {!Array.<!WebInspector.TracingManager.EventPayload>} */ (event.data);
        this._tracingModel.addEvents(traceEvents);
    },

    _onTracingComplete: function()
    {
        if (this._stopCallbackBarrier) {
            this._stopCallbackBarrier.callWhenDone(this._didStopRecordingTraceEvents.bind(this));
            this._stopCallbackBarrier = null;
        } else {
            this._didStopRecordingTraceEvents();
        }
    },

    /**
     * @param {!WebInspector.Target} target
     * @param {?Protocol.Error} error
     * @param {?ProfilerAgent.CPUProfile} cpuProfile
     */
    _didStopRecordingJSSamples: function(target, error, cpuProfile)
    {
        if (error)
            WebInspector.console.error(error);
        if (!this._cpuProfiles)
            this._cpuProfiles = {};
        this._cpuProfiles[target.id()] = cpuProfile;
    },

    _didStopRecordingTraceEvents: function()
    {
        this._tracingModel.tracingComplete();

        var events = this._tracingModel.devtoolsPageMetadataEvents();
        var workerMetadataEvents = this._tracingModel.devtoolsWorkerMetadataEvents();

        this._resetProcessingState();
        for (var i = 0, length = events.length; i < length; i++) {
            var event = events[i];
            var process = event.thread.process();
            var startTime = event.startTime;

            var endTime = Infinity;
            if (i + 1 < length)
                endTime = events[i + 1].startTime;

            var threads = process.sortedThreads();
            for (var j = 0; j < threads.length; j++) {
                var thread = threads[j];
                if (thread.name() === "WebCore: Worker" && workerMetadataEvents.every(function(e) { return e.args["data"]["workerThreadId"] !== thread.id(); }))
                    continue;
                this._processThreadEvents(startTime, endTime, event.thread, thread);
            }
        }
        this._resetProcessingState();

        this._inspectedTargetEvents.sort(WebInspector.TracingModel.Event.compareStartTime);

        this._cpuProfiles = null;

        this._buildTimelineRecords();
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordingStopped);
    },

    /**
     * @param {!ProfilerAgent.CPUProfile} cpuProfile
     */
    _injectCpuProfileEvent: function(cpuProfile)
    {
        var metaEvent = this._tracingModel.devtoolsPageMetadataEvents().peekLast();
        if (!metaEvent)
            return;
        var cpuProfileEvent = /** @type {!WebInspector.TracingManager.EventPayload} */ ({
            cat: WebInspector.TracingModel.DevToolsMetadataEventCategory,
            ph: WebInspector.TracingModel.Phase.Instant,
            ts: this._tracingModel.maximumRecordTime() * 1000,
            pid: metaEvent.thread.process().id(),
            tid: metaEvent.thread.id(),
            name: WebInspector.TimelineModel.RecordType.CpuProfile,
            args: { data: { cpuProfile: cpuProfile } }
        });
        this._tracingModel.addEvents([cpuProfileEvent]);
    },

    _buildTimelineRecords: function()
    {
        var topLevelRecords = this._buildTimelineRecordsForThread(this.mainThreadEvents());

        /**
         * @param {!WebInspector.TimelineModel.Record} a
         * @param {!WebInspector.TimelineModel.Record} b
         * @return {number}
         */
        function compareRecordStartTime(a, b)
        {
            // Never return 0 as otherwise equal records would be merged.
            return (a.startTime() <= b.startTime()) ? -1 : +1;
        }

        /**
         * @param {!WebInspector.TimelineModel.VirtualThread} virtualThread
         * @this {!WebInspector.TimelineModel}
         */
        function processVirtualThreadEvents(virtualThread)
        {
            var threadRecords = this._buildTimelineRecordsForThread(virtualThread.events);
            topLevelRecords = topLevelRecords.mergeOrdered(threadRecords, compareRecordStartTime);
        }
        this.virtualThreads().forEach(processVirtualThreadEvents.bind(this));


        for (var i = 0; i < topLevelRecords.length; i++) {
            var record = topLevelRecords[i];
            if (record.type() === WebInspector.TimelineModel.RecordType.Program)
                this._mainThreadTasks.push(record);
            if (record.type() === WebInspector.TimelineModel.RecordType.GPUTask)
                this._gpuThreadTasks.push(record);
        }
        this._records = topLevelRecords;
    },

    /**
     * @param {!Array.<!WebInspector.TracingModel.Event>} threadEvents
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    _buildTimelineRecordsForThread: function(threadEvents)
    {
        var recordStack = [];
        var topLevelRecords = [];

        for (var i = 0, size = threadEvents.length; i < size; ++i) {
            var event = threadEvents[i];
            for (var top = recordStack.peekLast(); top && top._event.endTime <= event.startTime; top = recordStack.peekLast()) {
                recordStack.pop();
                if (!recordStack.length)
                    topLevelRecords.push(top);
            }
            if (event.phase === WebInspector.TracingModel.Phase.AsyncEnd || event.phase === WebInspector.TracingModel.Phase.NestableAsyncEnd)
                continue;
            var parentRecord = recordStack.peekLast();
            // Maintain the back-end logic of old timeline, skip console.time() / console.timeEnd() that are not properly nested.
            if (WebInspector.TracingModel.isAsyncBeginPhase(event.phase) && parentRecord && event.endTime > parentRecord._event.endTime)
                continue;
            var record = new WebInspector.TimelineModel.Record(this, event);
            if (WebInspector.TimelineUIUtils.isMarkerEvent(event))
                this._eventDividerRecords.push(record);
            if (!this._recordFilter.accept(record))
                continue;
            if (parentRecord)
                parentRecord._addChild(record);
            if (event.endTime)
                recordStack.push(record);
        }

        if (recordStack.length)
            topLevelRecords.push(recordStack[0]);

        return topLevelRecords;
    },

    _resetProcessingState: function()
    {
        this._sendRequestEvents = {};
        this._timerEvents = {};
        this._requestAnimationFrameEvents = {};
        this._invalidationTracker = new WebInspector.InvalidationTracker();
        this._layoutInvalidate = {};
        this._lastScheduleStyleRecalculation = {};
        this._webSocketCreateEvents = {};
        this._paintImageEventByPixelRefId = {};
        this._lastPaintForLayer = {};
        this._lastRecalculateStylesEvent = null;
        this._currentScriptEvent = null;
        this._eventStack = [];
    },

    /**
     * @param {number} startTime
     * @param {?number} endTime
     * @param {!WebInspector.TracingModel.Thread} mainThread
     * @param {!WebInspector.TracingModel.Thread} thread
     */
    _processThreadEvents: function(startTime, endTime, mainThread, thread)
    {
        var events = thread.events();
        var length = events.length;
        var i = events.lowerBound(startTime, function (time, event) { return time - event.startTime });

        var threadEvents;
        var virtualThread = null;
        if (thread === mainThread) {
            threadEvents = this._mainThreadEvents;
            this._mainThreadAsyncEvents = this._mainThreadAsyncEvents.concat(thread.asyncEvents());
        } else {
            virtualThread = new WebInspector.TimelineModel.VirtualThread(thread.name());
            threadEvents = virtualThread.events;
            virtualThread.asyncEvents = virtualThread.asyncEvents.concat(thread.asyncEvents());
            this._virtualThreads.push(virtualThread);
        }

        this._eventStack = [];
        for (; i < length; i++) {
            var event = events[i];
            if (endTime && event.startTime >= endTime)
                break;
            this._processEvent(event);
            threadEvents.push(event);
            this._inspectedTargetEvents.push(event);
        }

        if (this._cpuProfiles && thread.target()) {
            var cpuProfile = this._cpuProfiles[thread.target().id()];
            if (cpuProfile) {
                var jsSamples = WebInspector.TimelineJSProfileProcessor.generateTracingEventsFromCpuProfile(cpuProfile, thread);
                var mergedEvents = threadEvents.mergeOrdered(jsSamples, WebInspector.TracingModel.Event.orderedCompareStartTime);
                var jsFrameEvents = WebInspector.TimelineJSProfileProcessor.generateJSFrameEvents(mergedEvents);
                mergedEvents = jsFrameEvents.mergeOrdered(mergedEvents, WebInspector.TracingModel.Event.orderedCompareStartTime);
                if (virtualThread)
                    virtualThread.events = mergedEvents;
                else
                    this._mainThreadEvents = mergedEvents;
                this._inspectedTargetEvents = this._inspectedTargetEvents.concat(jsSamples, jsFrameEvents);
            }
        }
    },

    /**
     * @param {!WebInspector.TracingModel.Event} event
     */
    _processEvent: function(event)
    {
        var recordTypes = WebInspector.TimelineModel.RecordType;

        var eventStack = this._eventStack;
        while (eventStack.length && eventStack.peekLast().endTime < event.startTime)
            eventStack.pop();
        var duration = event.duration;
        if (duration) {
            if (eventStack.length) {
                var parent = eventStack.peekLast();
                parent.selfTime -= duration;
            }
            event.selfTime = duration;
            eventStack.push(event);
        }

        if (this._currentScriptEvent && event.startTime > this._currentScriptEvent.endTime)
            this._currentScriptEvent = null;

        switch (event.name) {
        case recordTypes.CallStack:
            var lastMainThreadEvent = this.mainThreadEvents().peekLast();
            if (lastMainThreadEvent && event.args["stack"] && event.args["stack"].length)
                lastMainThreadEvent.stackTrace = event.args["stack"];
            break;

        case recordTypes.CpuProfile:
            this._cpuProfile = event.args["data"]["cpuProfile"];
            break;

        case recordTypes.ResourceSendRequest:
            this._sendRequestEvents[event.args["data"]["requestId"]] = event;
            event.imageURL = event.args["data"]["url"];
            break;

        case recordTypes.ResourceReceiveResponse:
        case recordTypes.ResourceReceivedData:
        case recordTypes.ResourceFinish:
            event.initiator = this._sendRequestEvents[event.args["data"]["requestId"]];
            if (event.initiator)
                event.imageURL = event.initiator.imageURL;
            break;

        case recordTypes.TimerInstall:
            this._timerEvents[event.args["data"]["timerId"]] = event;
            break;

        case recordTypes.TimerFire:
            event.initiator = this._timerEvents[event.args["data"]["timerId"]];
            break;

        case recordTypes.RequestAnimationFrame:
            this._requestAnimationFrameEvents[event.args["data"]["id"]] = event;
            break;

        case recordTypes.FireAnimationFrame:
            event.initiator = this._requestAnimationFrameEvents[event.args["data"]["id"]];
            break;

        case recordTypes.ScheduleStyleRecalculation:
            this._lastScheduleStyleRecalculation[event.args["frame"]] = event;
            break;

        case recordTypes.RecalculateStyles:
            this._invalidationTracker.didRecalcStyle(event);
            event.initiator = this._lastScheduleStyleRecalculation[event.args["frame"]];
            this._lastRecalculateStylesEvent = event;
            break;

        case recordTypes.StyleRecalcInvalidationTracking:
        case recordTypes.LayoutInvalidationTracking:
        case recordTypes.LayerInvalidationTracking:
        case recordTypes.PaintInvalidationTracking:
            this._invalidationTracker.addInvalidation(event);
            break;

        case recordTypes.InvalidateLayout:
            // Consider style recalculation as a reason for layout invalidation,
            // but only if we had no earlier layout invalidation records.
            var layoutInitator = event;
            var frameId = event.args["frame"];
            if (!this._layoutInvalidate[frameId] && this._lastRecalculateStylesEvent && this._lastRecalculateStylesEvent.endTime >  event.startTime)
                layoutInitator = this._lastRecalculateStylesEvent.initiator;
            this._layoutInvalidate[frameId] = layoutInitator;
            break;

        case recordTypes.Layout:
            this._invalidationTracker.didLayout(event);
            var frameId = event.args["beginData"]["frame"];
            event.initiator = this._layoutInvalidate[frameId];
            // In case we have no closing Layout event, endData is not available.
            if (event.args["endData"]) {
                event.backendNodeId = event.args["endData"]["rootNode"];
                event.highlightQuad =  event.args["endData"]["root"];
            }
            this._layoutInvalidate[frameId] = null;
            if (this._currentScriptEvent)
                event.warning = WebInspector.UIString("Forced synchronous layout is a possible performance bottleneck.");
            break;

        case recordTypes.WebSocketCreate:
            this._webSocketCreateEvents[event.args["data"]["identifier"]] = event;
            break;

        case recordTypes.WebSocketSendHandshakeRequest:
        case recordTypes.WebSocketReceiveHandshakeResponse:
        case recordTypes.WebSocketDestroy:
            event.initiator = this._webSocketCreateEvents[event.args["data"]["identifier"]];
            break;

        case recordTypes.EvaluateScript:
        case recordTypes.FunctionCall:
            if (!this._currentScriptEvent)
                this._currentScriptEvent = event;
            break;

        case recordTypes.SetLayerTreeId:
            this._inspectedTargetLayerTreeId = event.args["layerTreeId"];
            break;

        case recordTypes.Paint:
            this._invalidationTracker.didPaint(event);
            event.highlightQuad = event.args["data"]["clip"];
            event.backendNodeId = event.args["data"]["nodeId"];
            var layerUpdateEvent = this._findAncestorEvent(recordTypes.UpdateLayer);
            if (!layerUpdateEvent || layerUpdateEvent.args["layerTreeId"] !== this._inspectedTargetLayerTreeId)
                break;
            // Only keep layer paint events, skip paints for subframes that get painted to the same layer as parent.
            if (!event.args["data"]["layerId"])
                break;
            this._lastPaintForLayer[layerUpdateEvent.args["layerId"]] = event;
            break;

        case recordTypes.PictureSnapshot:
            var layerUpdateEvent = this._findAncestorEvent(recordTypes.UpdateLayer);
            if (!layerUpdateEvent || layerUpdateEvent.args["layerTreeId"] !== this._inspectedTargetLayerTreeId)
                break;
            var paintEvent = this._lastPaintForLayer[layerUpdateEvent.args["layerId"]];
            if (paintEvent)
                paintEvent.picture = event;
            break;

        case recordTypes.ScrollLayer:
            event.backendNodeId = event.args["data"]["nodeId"];
            break;

        case recordTypes.PaintImage:
            event.backendNodeId = event.args["data"]["nodeId"];
            event.imageURL = event.args["data"]["url"];
            break;

        case recordTypes.DecodeImage:
        case recordTypes.ResizeImage:
            var paintImageEvent = this._findAncestorEvent(recordTypes.PaintImage);
            if (!paintImageEvent) {
                var decodeLazyPixelRefEvent = this._findAncestorEvent(recordTypes.DecodeLazyPixelRef);
                paintImageEvent = decodeLazyPixelRefEvent && this._paintImageEventByPixelRefId[decodeLazyPixelRefEvent.args["LazyPixelRef"]];
            }
            if (!paintImageEvent)
                break;
            event.backendNodeId = paintImageEvent.backendNodeId;
            event.imageURL = paintImageEvent.imageURL;
            break;

        case recordTypes.DrawLazyPixelRef:
            var paintImageEvent = this._findAncestorEvent(recordTypes.PaintImage);
            if (!paintImageEvent)
                break;
            this._paintImageEventByPixelRefId[event.args["LazyPixelRef"]] = paintImageEvent;
            event.backendNodeId = paintImageEvent.backendNodeId;
            event.imageURL = paintImageEvent.imageURL;
            break;
        }
    },

    /**
     * @param {string} name
     * @return {?WebInspector.TracingModel.Event}
     */
    _findAncestorEvent: function(name)
    {
        for (var i = this._eventStack.length - 1; i >= 0; --i) {
            var event = this._eventStack[i];
            if (event.name === name)
                return event;
        }
        return null;
    },

    /**
     * @param {!Blob} file
     * @param {!WebInspector.Progress} progress
     */
    loadFromFile: function(file, progress)
    {
        var delegate = new WebInspector.TimelineModelLoadFromFileDelegate(this, progress);
        var fileReader = this._createFileReader(file, delegate);
        var loader = this.createLoader(fileReader, progress);
        fileReader.start(loader);
    },

    _createFileReader: function(file, delegate)
    {
        return new WebInspector.ChunkedFileReader(file, WebInspector.TimelineModel.TransferChunkLengthBytes, delegate);
    },

    _createFileWriter: function()
    {
        return new WebInspector.FileOutputStream();
    },

    saveToFile: function()
    {
        var now = new Date();
        var fileName = "TimelineRawData-" + now.toISO8601Compact() + ".json";
        var stream = this._createFileWriter();

        /**
         * @param {boolean} accepted
         * @this {WebInspector.TimelineModel}
         */
        function callback(accepted)
        {
            if (!accepted)
                return;
            this.writeToStream(stream);
        }
        stream.open(fileName, callback.bind(this));
    },

    reset: function()
    {
        this._virtualThreads = [];
        this._mainThreadEvents = [];
        this._mainThreadAsyncEvents = [];
        this._inspectedTargetEvents = [];

        this._records = [];
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._mainThreadTasks =  [];
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._gpuThreadTasks = [];
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._eventDividerRecords = [];
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordsCleared);
    },

    /**
     * @return {number}
     */
    minimumRecordTime: function()
    {
        return this._tracingModel.minimumRecordTime();
    },

    /**
     * @return {number}
     */
    maximumRecordTime: function()
    {
        return this._tracingModel.maximumRecordTime();
    },

    /**
     * @return {!Array.<!WebInspector.TracingModel.Event>}
     */
    inspectedTargetEvents: function()
    {
        return this._inspectedTargetEvents;
    },

    /**
     * @return {!Array.<!WebInspector.TracingModel.Event>}
     */
    mainThreadEvents: function()
    {
        return this._mainThreadEvents;
    },

    /**
     * @param {!Array.<!WebInspector.TracingModel.Event>} events
     */
    _setMainThreadEvents: function(events)
    {
        this._mainThreadEvents = events;
    },

    /**
     * @return {!Array.<!Array.<!WebInspector.TracingModel.Event>>}
     */
    mainThreadAsyncEvents: function()
    {
        return this._mainThreadAsyncEvents;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.VirtualThread>}
     */
    virtualThreads: function()
    {
        return this._virtualThreads;
    },

    /**
     * @param {!WebInspector.ChunkedFileReader} fileReader
     * @param {!WebInspector.Progress} progress
     * @return {!WebInspector.OutputStream}
     */
    createLoader: function(fileReader, progress)
    {
        return new WebInspector.TracingModelLoader(this, fileReader, progress);
    },

    /**
     * @param {!WebInspector.OutputStream} stream
     */
    writeToStream: function(stream)
    {
        var saver = new WebInspector.TracingTimelineSaver(stream);
        this._tracingModel.writeToStream(stream, saver);
    },

    /**
     * @return {boolean}
     */
    isEmpty: function()
    {
        return this.minimumRecordTime() === 0 && this.maximumRecordTime() === 0;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    mainThreadTasks: function()
    {
        return this._mainThreadTasks;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    gpuThreadTasks: function()
    {
        return this._gpuThreadTasks;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    eventDividerRecords: function()
    {
        return this._eventDividerRecords;
    },


    __proto__: WebInspector.Object.prototype
}

/**
 * @constructor
 */
WebInspector.TimelineModel.Filter = function()
{
    /** @type {!WebInspector.TimelineModel} */
    this._model;
}

WebInspector.TimelineModel.Filter.prototype = {
    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    accept: function(record)
    {
        return true;
    },

    notifyFilterChanged: function()
    {
        this._model._filterChanged();
    }
}

/**
 * @constructor
 * @extends {WebInspector.TimelineModel.Filter}
 * @param {!Array.<string>} recordTypes
 */
WebInspector.TimelineRecordTypeFilter = function(recordTypes)
{
    WebInspector.TimelineModel.Filter.call(this);
    this._recordTypes = recordTypes.keySet();
}

WebInspector.TimelineRecordTypeFilter.prototype = {
    __proto__: WebInspector.TimelineModel.Filter.prototype
}

/**
 * @constructor
 * @extends {WebInspector.TimelineRecordTypeFilter}
 * @param {!Array.<string>} recordTypes
 */
WebInspector.TimelineRecordHiddenEmptyTypeFilter = function(recordTypes)
{
    WebInspector.TimelineRecordTypeFilter.call(this, recordTypes);
}

WebInspector.TimelineRecordHiddenEmptyTypeFilter.prototype = {
    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    accept: function(record)
    {
        return record.children().length !== 0 || !this._recordTypes[record.type()];
    },

    __proto__: WebInspector.TimelineRecordTypeFilter.prototype
}

/**
 * @constructor
 * @extends {WebInspector.TimelineRecordTypeFilter}
 * @param {!Array.<string>} recordTypes
 */
WebInspector.TimelineRecordHiddenTypeFilter = function(recordTypes)
{
    WebInspector.TimelineRecordTypeFilter.call(this, recordTypes);
}

WebInspector.TimelineRecordHiddenTypeFilter.prototype = {
    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    accept: function(record)
    {
        return !this._recordTypes[record.type()];
    },

    __proto__: WebInspector.TimelineRecordTypeFilter.prototype
}

/**
 * @constructor
 * @extends {WebInspector.TimelineRecordTypeFilter}
 * @param {!Array.<string>} recordTypes
 */
WebInspector.TimelineRecordVisibleTypeFilter = function(recordTypes)
{
    WebInspector.TimelineRecordTypeFilter.call(this, recordTypes);
}

WebInspector.TimelineRecordVisibleTypeFilter.prototype = {
    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    accept: function(record)
    {
        return !!this._recordTypes[record.type()];
    },

    __proto__: WebInspector.TimelineRecordTypeFilter.prototype
}

/**
 * @constructor
 * @implements {WebInspector.OutputStreamDelegate}
 * @param {!WebInspector.TimelineModel} model
 * @param {!WebInspector.Progress} progress
 */
WebInspector.TimelineModelLoadFromFileDelegate = function(model, progress)
{
    this._model = model;
    this._progress = progress;
}

WebInspector.TimelineModelLoadFromFileDelegate.prototype = {
    onTransferStarted: function()
    {
        this._progress.setTitle(WebInspector.UIString("Loading\u2026"));
    },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     */
    onChunkTransferred: function(reader)
    {
        if (this._progress.isCanceled()) {
            reader.cancel();
            this._progress.done();
            this._model.reset();
            return;
        }

        var totalSize = reader.fileSize();
        if (totalSize) {
            this._progress.setTotalWork(totalSize);
            this._progress.setWorked(reader.loadedSize());
        }
    },

    onTransferFinished: function()
    {
        this._progress.done();
    },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     * @param {!Event} event
     */
    onError: function(reader, event)
    {
        this._progress.done();
        this._model.reset();
        switch (event.target.error.code) {
        case FileError.NOT_FOUND_ERR:
            WebInspector.console.error(WebInspector.UIString("File \"%s\" not found.", reader.fileName()));
            break;
        case FileError.NOT_READABLE_ERR:
            WebInspector.console.error(WebInspector.UIString("File \"%s\" is not readable", reader.fileName()));
            break;
        case FileError.ABORT_ERR:
            break;
        default:
            WebInspector.console.error(WebInspector.UIString("An error occurred while reading the file \"%s\"", reader.fileName()));
        }
    }
}


/**
 * @interface
 */
WebInspector.TraceEventFilter = function() { }

WebInspector.TraceEventFilter.prototype = {
    /**
     * @param {!WebInspector.TracingModel.Event} event
     * @return {boolean}
     */
    accept: function(event) { }
}

/**
 * @constructor
 * @implements {WebInspector.TraceEventFilter}
 * @param {!Array.<string>} eventNames
 */
WebInspector.TraceEventNameFilter = function(eventNames)
{
    this._eventNames = eventNames.keySet();
}

WebInspector.TraceEventNameFilter.prototype = {
    /**
     * @param {!WebInspector.TracingModel.Event} event
     * @return {boolean}
     */
    accept: function(event)
    {
        throw new Error("Not implemented.");
    }
}

/**
 * @constructor
 * @extends {WebInspector.TraceEventNameFilter}
 * @param {!Array.<string>} includeNames
 */
WebInspector.InclusiveTraceEventNameFilter = function(includeNames)
{
    WebInspector.TraceEventNameFilter.call(this, includeNames)
}

WebInspector.InclusiveTraceEventNameFilter.prototype = {
    /**
     * @override
     * @param {!WebInspector.TracingModel.Event} event
     * @return {boolean}
     */
    accept: function(event)
    {
        return event.category === WebInspector.TracingModel.ConsoleEventCategory || !!this._eventNames[event.name];
    },
    __proto__: WebInspector.TraceEventNameFilter.prototype
}

/**
 * @constructor
 * @extends {WebInspector.TraceEventNameFilter}
 * @param {!Array.<string>} excludeNames
 */
WebInspector.ExclusiveTraceEventNameFilter = function(excludeNames)
{
    WebInspector.TraceEventNameFilter.call(this, excludeNames)
}

WebInspector.ExclusiveTraceEventNameFilter.prototype = {
    /**
     * @override
     * @param {!WebInspector.TracingModel.Event} event
     * @return {boolean}
     */
    accept: function(event)
    {
        return !this._eventNames[event.name];
    },
    __proto__: WebInspector.TraceEventNameFilter.prototype
}

/**
 * @constructor
 * @implements {WebInspector.OutputStream}
 * @param {!WebInspector.TimelineModel} model
 * @param {!{cancel: function()}} reader
 * @param {!WebInspector.Progress} progress
 */
WebInspector.TracingModelLoader = function(model, reader, progress)
{
    this._model = model;
    this._reader = reader;
    this._progress = progress;
    this._buffer = "";
    this._firstChunk = true;
    this._loader = new WebInspector.TracingModel.Loader(model._tracingModel);
}

WebInspector.TracingModelLoader.prototype = {
    /**
     * @param {string} chunk
     */
    write: function(chunk)
    {
        var data = this._buffer + chunk;
        var lastIndex = 0;
        var index;
        do {
            index = lastIndex;
            lastIndex = WebInspector.TextUtils.findBalancedCurlyBrackets(data, index);
        } while (lastIndex !== -1)

        var json = data.slice(0, index) + "]";
        this._buffer = data.slice(index);

        if (!index)
            return;

        if (this._firstChunk) {
            this._model._startCollectingTraceEvents(true);
        } else {
            var commaIndex = json.indexOf(",");
            if (commaIndex !== -1)
                json = json.slice(commaIndex + 1);
            json = "[" + json;
        }

        var items;
        try {
            items = /** @type {!Array.<!WebInspector.TracingManager.EventPayload>} */ (JSON.parse(json));
        } catch (e) {
            this._reportErrorAndCancelLoading("Malformed timeline data: " + e);
            return;
        }

        if (this._firstChunk) {
            this._firstChunk = false;
            if (this._looksLikeAppVersion(items[0])) {
                this._reportErrorAndCancelLoading("Old Timeline format is not supported.");
                return;
            }
        }

        try {
            this._loader.loadNextChunk(items);
        } catch(e) {
            this._reportErrorAndCancelLoading("Malformed timeline data: " + e);
            return;
        }
    },

    _reportErrorAndCancelLoading: function(messsage)
    {
        WebInspector.console.error(messsage);
        this._model._onTracingComplete();
        this._model.reset();
        this._reader.cancel();
        this._progress.done();
    },

    _looksLikeAppVersion: function(item)
    {
        return typeof item === "string" && item.indexOf("Chrome") !== -1;
    },

    close: function()
    {
        this._loader.finish();
        this._model._onTracingComplete();
    }
}

/**
 * @constructor
 * @param {!WebInspector.OutputStream} stream
 * @implements {WebInspector.OutputStreamDelegate}
 */
WebInspector.TracingTimelineSaver = function(stream)
{
    this._stream = stream;
}

WebInspector.TracingTimelineSaver.prototype = {
    onTransferStarted: function()
    {
        this._stream.write("[");
    },

    onTransferFinished: function()
    {
        this._stream.write("]");
    },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     */
    onChunkTransferred: function(reader) { },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     * @param {!Event} event
     */
    onError: function(reader, event) { },
}

/**
 * @constructor
 * @param {!WebInspector.TracingModel.Event} event
 */
WebInspector.InvalidationTrackingEvent = function(event)
{
    this.type = event.name;
    this.frameId = event.args["data"]["frame"];
    this.nodeId = event.args["data"]["nodeId"];
    this.nodeName = event.args["data"]["nodeName"];
    this.paintId = event.args["data"]["paintId"];
    this.reason = event.args["data"]["reason"];
    this.stackTrace = event.args["data"]["stackTrace"];
}

/**
 * @constructor
 */
WebInspector.InvalidationTracker = function()
{
    this._initializePerFrameState();
}

WebInspector.InvalidationTracker.prototype = {
    /**
     * @param {!WebInspector.TracingModel.Event} event
     */
    addInvalidation: function(event)
    {
        var invalidation = new WebInspector.InvalidationTrackingEvent(event);

        this._startNewFrameIfNeeded();
        if (!invalidation.nodeId && !invalidation.paintId) {
            console.error("Invalidation lacks node information.");
            console.error(invalidation);
        }

        // Record the paintIds for style recalc or layout invalidations.
        // FIXME: This O(n^2) loop could be optimized with a map.
        var recordTypes = WebInspector.TimelineModel.RecordType;
        if (invalidation.type == recordTypes.PaintInvalidationTracking)
            this._invalidationEvents.forEach(updatePaintId);
        else
            this._invalidationEvents.push(invalidation);

        function updatePaintId(invalidationToUpdate)
        {
            if (invalidationToUpdate.nodeId !== invalidation.nodeId)
                return;
            if (invalidationToUpdate.type === recordTypes.StyleRecalcInvalidationTracking
                    || invalidationToUpdate.type === recordTypes.LayoutInvalidationTracking) {
                invalidationToUpdate.paintId = invalidation.paintId;
            }
        }
    },

    /**
     * @param {!WebInspector.TracingModel.Event} styleRecalcEvent
     */
    didRecalcStyle: function(styleRecalcEvent)
    {
        var recalcFrameId = styleRecalcEvent.args["frame"];
        var index = this._lastStyleRecalcEventIndex;
        var invalidationCount = this._invalidationEvents.length;
        for (; index < invalidationCount; index++) {
            var invalidation = this._invalidationEvents[index];
            if (invalidation.type !== WebInspector.TimelineModel.RecordType.StyleRecalcInvalidationTracking)
                continue;
            if (invalidation.frameId === recalcFrameId)
                this._addInvalidationTrackingEvent(styleRecalcEvent, invalidation);
        }

        this._lastStyleRecalcEventIndex = invalidationCount;
    },

    /**
     * @param {!WebInspector.TracingModel.Event} layoutEvent
     */
    didLayout: function(layoutEvent)
    {
        var layoutFrameId = layoutEvent.args["beginData"]["frame"];
        var index = this._lastLayoutEventIndex;
        var invalidationCount = this._invalidationEvents.length;
        for (; index < invalidationCount; index++) {
            var invalidation = this._invalidationEvents[index];
            if (invalidation.type !== WebInspector.TimelineModel.RecordType.LayoutInvalidationTracking)
                continue;
            if (invalidation.frameId === layoutFrameId)
                this._addInvalidationTrackingEvent(layoutEvent, invalidation);
        }

        this._lastLayoutEventIndex = invalidationCount;
    },

    /**
     * @param {!WebInspector.TracingModel.Event} paintEvent
     */
    didPaint: function(paintEvent)
    {
        this._didPaint = true;

        // If a paint doesn't have a corresponding graphics layer id, it paints
        // into its parent so add an effectivePaintId to these events.
        var layerId = paintEvent.args["data"]["layerId"];
        if (layerId)
            this._lastPaintWithLayer = paintEvent;
        if (!this._lastPaintWithLayer) {
            console.error("Failed to find the paint container for a paint event.");
            return;
        }

        var effectivePaintId = this._lastPaintWithLayer.args["data"]["nodeId"];
        var frameId = paintEvent.args["data"]["frame"];
        this._invalidationEvents.forEach(recordInvalidationForPaint.bind(this));

        /**
         * @param {!WebInspector.InvalidationTrackingEvent} invalidation
         * @this {WebInspector.InvalidationTracker}
         */
        function recordInvalidationForPaint(invalidation)
        {
            if (invalidation.paintId === effectivePaintId && invalidation.frameId === frameId)
                this._addInvalidationTrackingEvent(paintEvent, invalidation);
        }
    },

    /**
     * @param {!WebInspector.TracingModel.Event} event
     * @param {!WebInspector.InvalidationTrackingEvent} invalidation
     */
    _addInvalidationTrackingEvent: function(event, invalidation)
    {
        if (!event.invalidationTrackingEvents)
            event.invalidationTrackingEvents = [ invalidation ];
        else
            event.invalidationTrackingEvents.push(invalidation);
    },

    _startNewFrameIfNeeded: function()
    {
        if (!this._didPaint)
            return;

        this._initializePerFrameState();
    },

    _initializePerFrameState: function()
    {
        /** @type {!Array.<!WebInspector.InvalidationTrackingEvent>} */
        this._invalidationEvents = [];
        this._lastStyleRecalcEventIndex = 0;
        this._lastLayoutEventIndex = 0;
        this._lastPaintWithLayer = undefined;
        this._didPaint = false;
    }
}
