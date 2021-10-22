const crypto = require('crypto')
const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')

const userShema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please tell us your name!']
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    photo: String,
    role: {
        type: String,
        enum: ['user', 'guide', 'lead-guide', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 8,
        // proibe de mandar a senha em qualquer output
        select: false
    },
    passwordConfirm: {
        type: String,
        required: [true, 'Please confirm your password'],
        validate: {
            // só funciona na hora de salvar
            validator: function(el) {
                return el === this.password
            },
            message: 'Password are not the same!'
        }
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
        type: Boolean,
        default: true,
        select: false
    }
})

userShema.pre('save', async function(next) {
    // essa função só vai rodar quando a senha for modificada ou criada
    if (!this.isModified('password')) return next()

    // fazendo hash do password
    this.password = await bcrypt.hash(this.password, 12)

    // aqui a validação de senhas iguais já foi feita
    // então para este campo não ir para o BD, seta 'undefined'
    this.passwordConfirm = undefined
    next()
})

userShema.pre('save', function(next) {
    if(!this.isModified('password' || this.isNew)) return next()

    this.passwordChangedAt = Date.now() - 1000
    next()
})

userShema.pre(/^find/, function(next){
    this.find({active: {$ne: false}})
    next()
})

userShema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword)
}

userShema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if(this.passwordChangedAt) {
        const changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10)

        return JWTTimestamp < changedTimeStamp
    }

    // se for falso, a senha não foi alterada
    return false
}

userShema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex')

    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    this.passwordResetExpires = Date.now() + (10 * 60 * 1000)

    return resetToken
}

const User = mongoose.model('User', userShema)

module.exports = User