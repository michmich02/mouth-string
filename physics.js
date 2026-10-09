// Verlet Physics Engine for text string
const GRAVITY = 0.5;
const FRICTION = 0.95;
const BOUNDS_BOUNCE = 0.5;
const LINK_ITERATIONS = 5;

export class Node {
    constructor(x, y, char, isPinned = false) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.char = char;
        this.isPinned = isPinned;
        this.size = 24 + Math.random() * 4; // Slight variation in size
        
        // For independent falling letters
        this.life = 1.0; 
        this.decay = 0.002 + Math.random() * 0.003; 
        this.rotation = Math.random() * Math.PI * 2;
        this.vr = (Math.random() - 0.5) * 0.1;
        
        // Tracking angle for string mode
        this.angle = 0;
    }

    update() {
        if (this.isPinned) return;

        // Verlet integration
        const vx = (this.x - this.oldX) * FRICTION;
        const vy = (this.y - this.oldY) * FRICTION;

        this.oldX = this.x;
        this.oldY = this.y;

        this.x += vx;
        this.y += vy;

        // Apply gravity
        this.y += GRAVITY;

        // Update independent rotation
        this.rotation += this.vr;
    }

    constrainBounds(boundsHeight) {
        if (this.isPinned) return;

        if (this.y > boundsHeight) {
            this.y = boundsHeight;
            const vy = (this.y - this.oldY) * BOUNDS_BOUNCE;
            this.oldY = this.y + vy;
            // Friction on ground
            const vx = (this.x - this.oldX) * 0.5;
            this.oldX = this.x - vx;
            this.vr *= 0.8;
        }
    }
}

export class Link {
    constructor(nodeA, nodeB, restLength) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.restLength = restLength;
    }

    solve() {
        const dx = this.nodeA.x - this.nodeB.x;
        const dy = this.nodeA.y - this.nodeB.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        
        // Calculate difference ratio
        const difference = (this.restLength - dist) / dist;
        
        const offsetX = dx * 0.5 * difference;
        const offsetY = dy * 0.5 * difference;

        if (!this.nodeA.isPinned) {
            this.nodeA.x += offsetX;
            this.nodeA.y += offsetY;
        }
        if (!this.nodeB.isPinned) {
            this.nodeB.x -= offsetX;
            this.nodeB.y -= offsetY;
        }
    }
}

export class PhysicsSystem {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.strings = []; // Keeps track of active strings to drop them later
    }

    addIndependentLetter(char, x, y, vx, vy) {
        const node = new Node(x, y, char, false);
        // Inject velocity backwards
        node.oldX = x - vx;
        node.oldY = y - vy;
        this.nodes.push(node);
        return node;
    }

    startString(x, y, char) {
        const node = new Node(x, y, char, true); // Pinned to mouth
        this.nodes.push(node);
        
        const activeString = {
            nodes: [node],
            links: []
        };
        this.strings.push(activeString);
        return activeString;
    }

    addToString(activeString, x, y, char, restLength) {
        const prevNode = activeString.nodes[activeString.nodes.length - 1];
        prevNode.isPinned = false; // Unpin previous
        
        const newNode = new Node(x, y, char, true); // Pin new one (to hand)
        this.nodes.push(newNode);
        
        const link = new Link(prevNode, newNode, restLength);
        this.links.push(link);
        
        activeString.nodes.push(newNode);
        activeString.links.push(link);
    }

    insertAtMouth(activeString, x, y, char, restLength) {
        // The old first node is no longer pinned to the mouth
        const oldFirst = activeString.nodes[0];
        oldFirst.isPinned = false; 
        
        // Extrude it downwards so they don't clump on top of each other
        oldFirst.y += restLength;
        
        // Create a new first node pinned to the mouth
        const newFirst = new Node(x, y, char, true);
        this.nodes.push(newFirst);
        
        // Create a link between the new first and the old first
        const link = new Link(newFirst, oldFirst, restLength);
        this.links.push(link);
        
        // Unshift the new node to the beginning of the string
        activeString.nodes.unshift(newFirst);
        activeString.links.unshift(link); 
    }

    releaseString(activeString) {
        // Unpin everything EXCEPT the first node (which stays anchored to the mouth)
        for (let i = 1; i < activeString.nodes.length; i++) {
            activeString.nodes[i].isPinned = false; 
        }
        // DO NOT remove links! The string stays connected and hangs.
        // Remove string from active list since we are done pulling it
        const idx = this.strings.indexOf(activeString);
        if (idx !== -1) this.strings.splice(idx, 1);
    }

    explodeString(str, startX, startY) {
        for (let i = 0; i < str.length; i++) {
            if (str[i] === ' ') continue;
            const vx = (Math.random() - 0.5) * 10;
            const vy = (Math.random() - 0.5) * 10 - 2;
            const xOffset = (Math.random() - 0.5) * 40;
            const yOffset = (Math.random() - 0.5) * 40;
            this.addIndependentLetter(str[i], startX + xOffset, startY + yOffset, vx, vy);
        }
    }

    update(boundsHeight) {
        // 1. Update nodes
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            node.update();
            
            // Age independent nodes that have no links
            const isLinked = this.links.some(l => l.nodeA === node || l.nodeB === node);
            if (!isLinked && !node.isPinned) {
                node.life -= node.decay;
                if (node.life <= 0) {
                    this.nodes.splice(i, 1);
                    continue;
                }
            }
        }

        // 2. Solve constraints multiple times for stiffness
        for (let i = 0; i < LINK_ITERATIONS; i++) {
            for (const link of this.links) {
                link.solve();
            }
            
            // Constrain bounds after solving so they don't sink
            for (const node of this.nodes) {
                node.constrainBounds(boundsHeight);
            }
        }
        
        // 3. Update angles for linked nodes
        for (const link of this.links) {
            const dx = link.nodeB.x - link.nodeA.x;
            const dy = link.nodeB.y - link.nodeA.y;
            const angle = Math.atan2(dy, dx);
            link.nodeA.angle = angle;
            // The last node gets the same angle
            link.nodeB.angle = angle;
        }
    }
}
