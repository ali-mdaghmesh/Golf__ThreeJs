export class InstructionsPanel {
    constructor() {
        this.root = document.getElementById('instructions-panel');
        this.toggleBtn = document.getElementById('btn-help');
        this.closeBtn = document.getElementById('instructions-close');
        this.backdrop = document.getElementById('instructions-backdrop');

        this._bind();
    }

    _bind() {
        const stop = (e) => e.stopPropagation();
        this.toggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        this.closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });
        this.backdrop?.addEventListener('click', () => this.hide());
        this.root?.addEventListener('click', stop);
    }

    show() {
        this.root?.classList.add('open');
        this.backdrop?.classList.add('open');
    }

    hide() {
        this.root?.classList.remove('open');
        this.backdrop?.classList.remove('open');
    }

    toggle() {
        if (this.root?.classList.contains('open')) this.hide();
        else this.show();
    }
}
