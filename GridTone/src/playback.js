/** One owner for listening targets. Temporary audition never mutates the musical document. */
(function (G) {
    'use strict';
    class PlaybackController {
        constructor(engine, getProject, getSession, context, onChange = () => { }, onError = () => { }) {
            Object.assign(this, { engine, getProject, getSession, context, onChange, onError });
            this.auditionProject = null;
            this.auditionScope = null;
        }
        scope() { return this.auditionProject ? this.auditionScope : G.scopeFor(this.getProject(), this.getSession(), this.context); }
        async start(target = this.context.target, start = 0) {
            this.endAudition();
            this.context.target = target;
            try {
                const s = this.scope();
                G.resolvePlaybackScope(this.getProject(), s);
                await this.engine.play(this.getProject(), s, this.context.loop, start);
            }
            catch (e) {
                this.engine.stop();
                this.onError(e.message);
            }
            this.onChange();
        }
        async toggle() {
            if (this.engine.playing || this.engine.starting) {
                this.engine.pause();
                this.onChange();
                return;
            }
            if (this.auditionProject) {
                try {
                    await this.engine.play(this.auditionProject, this.auditionScope, this.context.loop, this.engine.pausedAt);
                }
                catch (e) {
                    this.onError(e.message);
                }
                this.onChange();
                return;
            }
            return this.start(this.context.target, this.engine.pausedAt);
        }
        endAudition() { if (this.auditionProject) {
            this.engine.stop();
            this.auditionProject = null;
            this.auditionScope = null;
            delete this.context.audition;
        } }
        stop() { this.engine.stop(); this.endAudition(); this.onChange(); }
        setTarget(target) { this.stop(); this.context.target = target; this.onChange(); }
        editorChanged() {
            if (this.auditionProject) {
                this.stop();
                return;
            }
            if (['pattern', 'bar'].includes(this.context.target)) {
                if (this.engine.playing || this.engine.starting)
                    this.updateProject();
                else
                    this.engine.stop();
            }
        }
        leaveEditor() { if (this.auditionProject || ['pattern', 'bar'].includes(this.context.target)) {
            this.stop();
            this.context.target = 'song';
        } }
        updateProject() { if (this.auditionProject)
            this.endAudition(); try {
            this.engine.update(this.getProject(), this.scope());
        }
        catch (e) {
            this.engine.stop();
            this.onError(e.message);
        } }
        toggleSolo(id) { const b = this.context; b.soloIds = b.soloIds.includes(id) ? b.soloIds.filter(x => x !== id) : [...b.soloIds, id]; this.updateProject(); this.onChange(); }
        restoreSong() { this.context.soloIds = []; const active = this.engine.playing || this.engine.starting; this.endAudition(); this.context.target = 'song'; if (active)
            this.updateProject();
        else
            this.engine.stop(); this.onChange(); }
        async audition(p, scope, label) {
            this.engine.stop();
            this.auditionProject = p;
            this.auditionScope = scope;
            this.context.audition = label;
            try {
                await this.engine.play(p, scope, this.context.loop, 0);
            }
            catch (e) {
                this.endAudition();
                this.onError(e.message);
            }
            this.onChange();
            return this.engine.playing && this.auditionProject === p;
        }
        exportScope(range = 'song') {
            const p = this.getProject(), s = this.getSession();
            if (range === 'pattern')
                return { kind: 'pattern', trackId: s.trackId, patternId: s.patternId, ignoreMute: true };
            if (range === 'current')
                return G.scopeFor(p, s, this.context);
            return { kind: 'song', soloIds: [] };
        }
    }
    Object.assign(G, { PlaybackController });
})(globalThis.GridTone ||= {});
