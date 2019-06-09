class Entry {
    constructor(link, author) {
        this.link = link;
        this.name = "Name pending...";
        this.author = author;
        this.voters = [] // Votekick
    }

    getName() {
        return this.name.toString();
    }

    setName(name) {
        this.name = name;
    }

    getAuthor() {
        return this.author;
    }

    getLink() {
        return this.link.toString();
    }

    getVotes() {
        return this.voters.length;
    }

    addVote(voter) { // TODO: Check this
        if (voter in this.voters) {
            return false;
        }
        this.voters.push(voter);
        return true;
    }
}

module.exports = Entry;