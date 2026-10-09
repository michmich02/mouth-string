export class Renderer {
    constructor(canvas, physics) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.physics = physics;
        this.width = canvas.width;
        this.height = canvas.height;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
    }

    render(state = null) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update Physics
        this.physics.update(this.height);

        // Draw Nodes
        for (const node of this.physics.nodes) {
            this.ctx.save();
            this.ctx.translate(node.x, node.y);
            
            // If it's part of a string, use tracked angle, else independent rotation
            const isLinked = this.physics.links.some(l => l.nodeA === node || l.nodeB === node);
            if (isLinked) {
                this.ctx.rotate(node.angle);
            } else {
                this.ctx.rotate(node.rotation);
            }
            
            // Visual styling
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = `rgba(240, 240, 240, ${isLinked ? 1.0 : node.life})`;
            this.ctx.font = `${node.size}px 'Playfair Display', serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.char, 0, 0);
            
            this.ctx.restore();
        }

        // Debug trackers removed for a cleaner look
    }
}
