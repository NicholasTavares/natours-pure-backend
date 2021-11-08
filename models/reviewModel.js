const mongoose = require('mongoose')
const Tours = require('./tourModel')

const reviewShema = new mongoose.Schema({
    review: {
        type: String,
        require: [true, 'Review can not be empty!']
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    createAt: {
        type: Date,
        default: Date.now()
    },
    tour: {
        type: mongoose.Schema.ObjectId,
        ref: 'Tour',
        required: [true, 'Review must belong to a tour.']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        require: [true, 'Review must belong to a user']
    }
},
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
)

reviewShema.index({ tour: 1, user: 1 }, { unique: true })

reviewShema.pre(/^find/, function (next) {
    /* this.populate({
      path: 'tour',
      select: 'name'
    }).populate({
        path: 'user',
        select: 'name photo'
    }).select('-__v'); */

    this.populate({
        path: 'user',
        select: 'name photo'
    }).select('-__v');

    next()
})

reviewShema.statics.calcAverageRatings = async function (tourId) {
    const stats = await this.aggregate([
        {
            $match: { tour: tourId }
        },
        {
            $group: {
                _id: '$tour',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' }
            }
        }
    ])
    if (stats.length > 0) {
        await Tours.findByIdAndUpdate(tourId, {
            ratingsQuantity: stats[0].nRating,
            ratingsAverage: stats[0].avgRating
        })
    } else {
        await Tours.findByIdAndUpdate(tourId, {
            ratingsQuantity: 0,
            ratingsAverage: 4.5
        })
    }
}

reviewShema.post('save', function () {
    // this point to current review
    this.constructor.calcAverageRatings(this.tour)
})

reviewShema.pre(/^findOneAnd/, async function (next) {
    this.r = await this.findOne()
    console.log(this.r)
    next()
})

reviewShema.post(/^findOneAnd/, async function (next) {
    // await this.findOne(); does NOT work here, query has already executed
    await this.r.constructor.calcAverageRatings(this.r.tour)
})

const Review = mongoose.model('Review', reviewShema)

module.exports = Review